const cds = require('@sap/cds');
const fileUpload = require('express-fileupload');
const XLSX = require("xlsx");
const axios = require('axios');
const app = cds.app;
app.use(require("express").json());
app.use(fileUpload());
const JSZip = require("jszip");
app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.set('x-csrf-token', 'Fetch'); // respond with token fetch header
  }
  next();
});
app.get('/downloadZip/:vendorID', async (req, res) => {
  const { vendorID } = req.params;

  const files = await SELECT.from('my.vendor.VendorPDFs')
    .where({ vendor_ID: vendorID });

  if (!files || files.length === 0) {
    return res.status(404).send("No files found");
  }

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


// Upload PDF endpoint
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

    res.send("File uploaded successfully");
  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).send("File upload failed");
  }
});

app.post('/updateApproverComments2', async (req, res) => {
  try {
    const { vendorID, Status, approvercomments2 } = req.body;
    console.log("📥 Incoming body:", req.body);
    if (!vendorID || !Status) {
      return res.status(400).send("Missing vendorID or Status");
    }

    const result = await UPDATE('my.vendor.Vendors')
      .set({ status: Status,approvercomments2 })      
      .where({ ID: vendorID });

    if (result === 0) {
      return res.status(404).send(`Vendor with ID ${vendorID} not found`);
    }

    res.send({ message: "Status updated", vendorID });
  } catch (err) {
    console.error("❌ Error in /updateApproverComments:", err);
    res.status(500).send("Internal Server Error");
  }
});
app.post('/updateApproverComments1', async (req, res) => {
  try {
    const { vendorID, Status,approvercomments1 } = req.body;
    console.log("📥 Incoming body:", req.body);
    if (!vendorID || !Status) {
      return res.status(400).send("Missing vendorID or Status");
    }

    const result = await UPDATE('my.vendor.Vendors')
      .set({ status: Status, approvercomments1})       // ✅ Only if Status is valid
      .where({ ID: vendorID });

    if (result === 0) {
      return res.status(404).send(`Vendor with ID ${vendorID} not found`);
    }

    res.send({ message: "Status updated", vendorID });
  } catch (err) {
    console.error("❌ Error in /updateApproverComments:", err);
    res.status(500).send("Internal Server Error");
  }
});


async function startBPAWorkflow({ name, email, id, phone, status }) {
  const url = "https://spa-api-gateway-bpi-us-prod.cfapps.us10.hana.ondemand.com/workflow/rest/v1/workflow-instances";
  const [file] = await SELECT.from('my.vendor.VendorPDFs')
    .columns('fileName')
    .where({ vendor_ID: id });

    const fileZipLink = `https://the-hackett-group-d-b-a-answerthink--inc--at-developmen3a1acfaf.cfapps.us10.hana.ondemand.com/downloadZip/${id}`;

  const pdf = `https://drive.google.com/file/d/1h2EyBjfWKxU-G2j67JRWdHyUmD7wCpGB/view?usp=drivesdk`;
  const payload = {
    definitionId: "us10.at-development-hgv7q18y.vendorcapapplication1.vendor_CAPM_Process",
    context: {
      _name: name,
      email: email,
      id: id,
      pdfs: fileZipLink,
      phone: phone,
      status: status
    }
  };

  
  const clientId = "sb-ec4f4f47-97ac-4c93-84c8-4d7ff979b6ea!b74367|xsuaa!b49390";
  const clientSecret = "8f5b2eb1-51ef-47a2-aa05-ce648e268f9c$hsvvplXdPJAhpvL0mpD7yOHoUR60BApUYvnKqpsWsIY=";

  
  const tokenResp = await axios.post(
    "https://at-development-hgv7q18y.authentication.us10.hana.ondemand.com/oauth/token",
    new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

  const accessToken = tokenResp.data.access_token;
  console.log(accessToken);
  // Trigger BPA workflow
   await axios.post(url, payload, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });
  
  console.log(`Bearer ${accessToken}`);
  console.log('Hi', +bpaResp);
  return bpaResp.data;
}

module.exports = async (srv) => {

  
  srv.on('VendorCreation', async (req) => {
    const { ID, name, email, phone } = req.data;

    if (!name || !email || !phone || !ID) {
      return req.error(400, 'Vendor details are incomplete');
    }

    const status = 'OPEN';
    const approvercomments1 = 'PENDING';
    const approvercomments2 = 'PENDING';

    const newVendor = await INSERT.into('my.vendor.Vendors').entries({
      ID, name, email, phone, status, approvercomments1, approvercomments2
    });

    
    try {
      await startBPAWorkflow({
        name,
        email,
        id: ID,
        phone,
        status,
        pdfs: ""
      });
    } catch (err) {
      console.error("Failed to trigger BPA workflow:", err.message);
    }

    return newVendor;
  });

 
  srv.on('getIds', async (req) => {
    const ids = await SELECT.from('my.vendor.Vendors').columns('ID');
    return ids;
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

    if (!vendor_ID) {
      req._.res.status(400).json({ message: 'Missing vendor_ID' });
      return;
    }

    const files = await SELECT.from('my.vendor.VendorPDFs')
      .columns('ID', 'fileName', 'content', 'mimeType', 'vendor_ID')
      .where({ vendor_ID });

    if (!files || files.length === 0) {
      req._.res.status(404).json({ message: 'No files found for this vendor' });
      return;
    }

    return files.map(file => ({
      fileName: file.fileName,
      content: file.content,
      mimeType: file.mimeType
    }));
  });

};
