const cds = require('@sap/cds');
const fileUpload = require('express-fileupload');
const XLSX = require("xlsx");
const app = cds.app;

app.use(fileUpload());

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
    //hit BPA link
    return newVendor;
  });
  srv.on('getIds', async (req) => {
    const ids = await SELECT.from('my.vendor.Vendors').columns('ID');
    return ids;
  });
  srv.on('getdetails', async (req) => {
    const { name } = req.data;
    console.log('req.data:', req.data);

    console.log(name);
    const files = await SELECT.from('my.vendor.Vendors').columns('status', 'approvercomments1', 'approvercomments2')
      .where({ name });
    if(!files)
    {
      console.log(files.length)
    }
    
    return files.map(file => ({
      status: file.status,
      approvercomments1: file.approvercomments1,
      approvercomments2: file.approvercomments2
    }));
  });
  srv.on('updateApproverComments', async (req) => {
    const { ID, approvercomments1 } = req.data;


    if (!ID || (!approvercomments1)) {
      return req.error(400, 'Vendor ID and at least one comment must be provided.');
    }


    const updateFields = {};
    if (approvercomments1 !== undefined) updateFields.approvercomments1 = approvercomments1;

    const result = await UPDATE('my.vendor.Vendors')
      .set(updateFields)
      .where({ ID });

    if (result === 0) {
      return req.error(404, `Vendor with ID ${ID} not found.`);
    }

    return { message: 'Vendor comments updated successfully', ID };
  });
  srv.on('updateApproverComments2', async (req) => {
    const { ID, approvercomments2 } = req.data;


    if (!ID || (!approvercomments2)) {
      return req.error(400, 'Vendor ID and at least one comment must be provided.');
    }


    const updateFields = {};

    if (approvercomments2 !== undefined) updateFields.approvercomments2 = approvercomments2;

    const result = await UPDATE('my.vendor.Vendors')
      .set(updateFields)
      .where({ ID });

    if (result === 0) {
      return req.error(404, `Vendor with ID ${ID} not found.`);
    }

    return { message: 'Vendor comments updated successfully', ID };
  });


  srv.on('download', async (req) => {
    const { vendor_ID } = req.data;
    console.log("vendorid",vendor_ID);
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
