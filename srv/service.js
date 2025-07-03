// Updated CAP service logic with approval flow inserts/updates and auto-trigger for next levels

const cds = require('@sap/cds');
const fileUpload = require('express-fileupload');
const XLSX = require("xlsx");
const axios = require('axios');
const JSZip = require("jszip");
const app = cds.app;
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
const { data } = require('hdb/lib/protocol');

app.use(require("express").json());
app.use(fileUpload());

app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.set('x-csrf-token', 'Fetch');
  }
  next();
});

// File download endpoints
app.get('/downloadZip/:vendorID', async (req, res) => {
  const { vendorID } = req.params;
  const files = await SELECT.from('my.vendor.VendorPDFs').where({ vendor_ID: vendorID });
  if (!files || files.length === 0) return res.status(404).send("No files found");

  const zip = new JSZip();
  files.forEach(file => {
    const buffer = Buffer.from(file.content, 'base64');
    zip.file(file.fileName, buffer);
  });

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  res.setHeader('Content-Disposition', `attachment; filename="Vendor_${vendorID}_Files.zip"`);
  res.setHeader('Content-Type', 'application/zip');
  res.send(zipBuffer);
});

app.get('/downloadFile/:fileID', async (req, res) => {
  const { fileID } = req.params;
  const file = await SELECT.one.from('my.vendor.VendorPDFs').where({ ID: fileID });
  if (!file) return res.status(404).send("File not found");

  const buffer = Buffer.from(file.content, 'base64');
  res.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`);
  res.setHeader('Content-Type', file.mimeType);
  res.send(buffer);
});

// File upload + BPA delay trigger
const uploadTimers = {};
app.post('/uploadPDF', async (req, res) => {
  try {
    const vendorID = req.body.vendorID;
    if (!vendorID || !req.files || !req.files.file) return res.status(400).send("Missing vendorID or file");

    const uploadedFile = req.files.file;
    const base64Content = uploadedFile.data.toString('base64');
    await INSERT.into('my.vendor.VendorPDFs').entries({
      ID: cds.utils.uuid(), fileName: uploadedFile.name,
      mimeType: uploadedFile.mimetype, content: base64Content,
      createdAt: new Date(), vendor_ID: vendorID
    });

    await UPDATE('my.vendor.Vendors').set({ uploadTime: new Date() }).where({ ID: vendorID });

    if (uploadTimers[vendorID]) clearTimeout(uploadTimers[vendorID]);
    uploadTimers[vendorID] = setTimeout(async () => {
      try {
        const [vendor] = await SELECT.from('my.vendor.Vendors').where({ ID: vendorID });
        if (!vendor) return console.error("Vendor not found for BPA");

        await triggerNextApprover(vendorID);

        await UPDATE('my.vendor.Vendors').set({ bpaTriggered: true }).where({ ID: vendorID });
        console.log(`✅ BPA triggered for vendor ${vendorID}`);
        delete uploadTimers[vendorID];
      } catch (err) {
        console.error(`❌ BPA trigger failed for vendor ${vendorID}:`, err);
      }
    }, 10000); 

    res.send("File uploaded successfully. BPA will trigger in 1 hour if no more uploads.");
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).send("Upload failed");
  }
});

// BPA Workflow trigger
async function startBPAWorkflow({ name, email, id, phone, status, approver_email, approver_level }) {
  const files = await SELECT.from('my.vendor.VendorPDFs').columns('ID', 'fileName').where({ vendor_ID: id });
  const host = 'https://the-hackett-group-d-b-a-answerthink--inc--at-developmen3a1acfaf.cfapps.us10.hana.ondemand.com';
  const fileLinks = files.map(file => `${host}/downloadFile/${file.ID}`);
  const fileZipLink = `${host}/downloadZip/${id}`;

  const [attachment1, attachment2, attachment3, attachment4, attachment5, attachment6] = [
    fileLinks[0] || "", fileLinks[1] || "", fileLinks[2] || "",
    fileLinks[3] || "", fileLinks[4] || "", fileLinks[5] || "",
  ];
  
  return await executeHttpRequest(
    { destinationName: 'spa_process_destination' },
    {
      method: 'POST', url: "/",
      data: {
        definitionId: "us10.at-development-hgv7q18y.vendorcapapplication1.vendor_CAPM_Process",
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'Fetch'
        },
        context: {
          _name: name,
          email,
          id,
          phone,
          status,
          attachment1,
          attachment2,
          attachment3,
          attachment4,
          attachment5,
          attachment6,
          pdfs: fileZipLink,
          approver_level,
          approver_email
        }
      }
    }
    
  );
  
}

// Looping BPA trigger
async function triggerNextApprover(vendorID) {
  const vendor = await SELECT.one.from('my.vendor.Vendors').where({ ID: vendorID });
  const approvals = await SELECT.from('my.vendor.VendorApprovals')
    .where({ vendor_ID: vendorID })
    .orderBy('level asc');

  for (const approver of approvals) {
    if (approver.status === 'PENDING') {
      console.log(`Triggering BPA for level ${approver.level}`);
      await startBPAWorkflow({
        name: vendor.name,
        email: vendor.email,
        id: vendorID,
        phone: vendor.phone,
        status: vendor.status,
        approver_email: approver.approver_email,
        approver_level: approver.level
      });
      break; // wait for callback
    }
  }
}


app.post('/bpa-callback', async (req, res) => {
  try {
    const { vendorID, level, status, comments, approver_email } = req.body;
    if (!vendorID || !level || !status || !approver_email) return res.status(400).send("Missing fields");

    await UPDATE('my.vendor.VendorApprovals')
      .set({ status, comments, updatedAt: new Date() })
      .where({ vendor_ID: vendorID, level, approver_email });

    if (status === 'REJECTED') {
      await UPDATE('my.vendor.Vendors').set({ status: 'REJECTED' }).where({ ID: vendorID });
      return res.send({ message: "Approval rejected." });
    }
    const nextLevel = (parseInt(level, 10) + 1).toString();
    const next = await SELECT.one.from('my.vendor.VendorApprovals')
      .where({ vendor_ID: vendorID, level: nextLevel });
    console.log("next", next);
    if (next) {
      await triggerNextApprover(vendorID);
    } else {
      await UPDATE('my.vendor.Vendors').set({ status: 'FINAL_APPROVED' }).where({ ID: vendorID });
      return res.send({ message: "All levels approved." });
    }

    res.send({ message: "Approval recorded. Next level in progress." });
  } catch (err) {
    console.error("❌ BPA callback failed:", err);
    res.status(500).send("Callback failed");
  }
});

module.exports = async (srv) => {
  srv.on('VendorCreation', async (req) => {
    const { ID, name, email, phone } = req.data;
    if (!name || !email || !phone || !ID) return req.error(400, 'Incomplete data');
  
    const status = 'OPEN';
  
    const vendorInsert = await INSERT.into('my.vendor.Vendors').entries({
      ID, name, email, phone, status, bpaTriggered: false
    });
  
    const approversList = await SELECT.from('my.vendor.Approvers').orderBy('level');
  
    const approvalEntries = approversList.map(approver => ({
      ID: cds.utils.uuid(),
      vendor_ID: ID,
      level: approver.level,
      approver_email: approver.approver_email,
      approver_name: `Approver ${approver.level}`,
      status: 'PENDING',
      updatedAt: new Date().toISOString()
    }));
  
    if (approvalEntries.length) {
      await INSERT.into('my.vendor.VendorApprovals').entries(approvalEntries);
    }
  
    return vendorInsert;
  });
  

  srv.on('download', async (req) => {
    const { vendor_ID } = req.data;
    if (!vendor_ID) return req._.res.status(400).json({ message: 'Missing vendor_ID' });

    const files = await SELECT.from('my.vendor.VendorPDFs')
      .columns('ID', 'fileName', 'content', 'mimeType', 'vendor_ID')
      .where({ vendor_ID });

    if (!files || files.length === 0) return req._.res.status(404).json({ message: 'No files found' });

    return files.map(file => ({
      fileName: file.fileName,
      content: file.content,
      mimeType: file.mimeType
    }));
  });
};
