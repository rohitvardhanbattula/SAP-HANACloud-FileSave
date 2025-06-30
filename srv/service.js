const cds = require('@sap/cds');
const fileUpload = require('express-fileupload');
const XLSX = require("xlsx");
const axios = require('axios');
const JSZip = require("jszip");
const app = cds.app;

app.use(require("express").json());
app.use(fileUpload());

app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.set('x-csrf-token', 'Fetch');
  }
  next();
});

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
  res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
  res.setHeader('Content-Type', file.mimeType);
  res.send(buffer);
});

app.post('/uploadPDF', async (req, res) => {
  try {
    const vendorID = req.body.vendorID;
    if (!vendorID) return res.status(400).send("Missing vendorID");
    if (!req.files || !req.files.file) return res.status(400).send("No file uploaded");

    const uploadedFile = req.files.file;
    const base64Content = uploadedFile.data.toString('base64');

    await INSERT.into('my.vendor.VendorPDFs').entries({
      ID: cds.utils.uuid(),
      fileName: uploadedFile.name,
      mimeType: uploadedFile.mimetype,
      content: base64Content,
      createdAt: new Date(),
      vendor_ID: vendorID
    });

    const [vendor] = await SELECT.from('my.vendor.Vendors').where({ ID: vendorID });
    if (!vendor) return res.status(400).send("Vendor not found");

    await startBPAWorkflow({
      name: vendor.name,
      email: vendor.email,
      id: vendorID,
      phone: vendor.phone,
      status: vendor.status
    });

    res.send("File uploaded and workflow triggered successfully");
  } catch (err) {
    console.error("Upload or BPA trigger failed:", err);
    res.status(500).send("Something went wrong");
  }
});

app.post('/updateApproverComments1', async (req, res) => {
  try {
    const { vendorID, Status, approvercomments1 } = req.body;
    if (!vendorID || !Status) return res.status(400).send("Missing vendorID or Status");

    const result = await UPDATE('my.vendor.Vendors')
      .set({ status: Status, approvercomments1 })
      .where({ ID: vendorID });

    if (result === 0) return res.status(404).send(`Vendor with ID ${vendorID} not found`);
    res.send({ message: "Status updated", vendorID });
  } catch (err) {
    console.error("❌ Error in /updateApproverComments1:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.post('/updateApproverComments2', async (req, res) => {
  try {
    const { vendorID, Status, approvercomments2 } = req.body;
    if (!vendorID || !Status) return res.status(400).send("Missing vendorID or Status");

    const result = await UPDATE('my.vendor.Vendors')
      .set({ status: Status, approvercomments2 })
      .where({ ID: vendorID });

    if (result === 0) return res.status(404).send(`Vendor with ID ${vendorID} not found`);
    res.send({ message: "Status updated", vendorID });
  } catch (err) {
    console.error("❌ Error in /updateApproverComments2:", err);
    res.status(500).send("Internal Server Error");
  }
});
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
async function startBPAWorkflow({ name, email, id, phone, status }) {
  const files = await SELECT.from('my.vendor.VendorPDFs')
    .columns('ID', 'fileName')
    .where({ vendor_ID: id });

  const host = 'https://the-hackett-group-d-b-a-answerthink--inc--at-developmen3a1acfaf.cfapps.us10.hana.ondemand.com';
  const fileZipLink = `${host}/downloadZip/${id}`;

  const downloadLinks = files.map(file => ({
    name: file.fileName,
    link: `${host}/downloadFile/${file.ID}`
  }));

  try {
    return await executeHttpRequest(
        {
            destinationName: 'spa_process_destination'
        }, {
            method: 'POST',
            url: "/",
            data: {
              definitionId: "us10.at-development-hgv7q18y.vendorcapapplication1.vendor_CAPM_Process",
              context: {
                _name: name,
                email,
                id,
                phone,
                status,
                pdfs: fileZipLink,
                files: downloadLinks
              }
        } 
      });
} catch (e) {
    console.error(e);
};



module.exports = async (srv) => {
  srv.on('VendorCreation', async (req) => {
    const { ID, name, email, phone } = req.data;
    if (!name || !email || !phone || !ID) return req.error(400, 'Vendor details are incomplete');

    const status = 'OPEN';
    const approvercomments1 = 'PENDING';
    const approvercomments2 = 'PENDING';

    return await INSERT.into('my.vendor.Vendors').entries({
      ID, name, email, phone, status, approvercomments1, approvercomments2
    });
  });

  srv.on('getIds', async (req) => {
    return await SELECT.from('my.vendor.Vendors').columns('ID');
  });

  srv.on('getdetails', async (req) => {
    const { name } = req.data;
    const files = await SELECT.from('my.vendor.Vendors')
      .columns('status', 'approvercomments1', 'approvercomments2')
      .where({ name });

    return files.map(file => ({
      status: file.status,
      approvercomments1: file.approvercomments1,
      approvercomments2: file.approvercomments2
    }));
  });

  srv.on('download', async (req) => {
    const { vendor_ID } = req.data;
    if (!vendor_ID) return req._.res.status(400).json({ message: 'Missing vendor_ID' });

    const files = await SELECT.from('my.vendor.VendorPDFs')
      .columns('ID', 'fileName', 'content', 'mimeType', 'vendor_ID')
      .where({ vendor_ID });

    if (!files || files.length === 0) return req._.res.status(404).json({ message: 'No files found for this vendor' });

    return files.map(file => ({
      fileName: file.fileName,
      content: file.content,
      mimeType: file.mimeType
    }));
  });
};
