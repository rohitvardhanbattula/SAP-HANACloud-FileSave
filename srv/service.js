const cds = require('@sap/cds');
const fileUpload = require('express-fileupload');
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
    const { ID, name, email, phone, status } = req.data;

    if (!name || !email || !phone || !ID || !status) {
      return req.error(400, 'Vendor details are incomplete');
    }

    const newVendor = await INSERT.into('my.vendor.Vendors').entries({
      ID, name, email, phone, status
    });

    return newVendor;
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
