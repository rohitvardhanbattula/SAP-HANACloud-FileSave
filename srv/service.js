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

    const mimeType = uploadedFile.mimetype;

    let fileCategory;
    if (mimeType.startsWith('image/')) {
      fileCategory = 'image';
    } else if (mimeType === 'application/pdf') {
      fileCategory = 'pdf';
    } else if (mimeType === 'application/msword' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      fileCategory = 'word';
    } else {
      return res.status(400).send("Unsupported file type");
    }

    let bufferToSave;
    if (Buffer.isBuffer(uploadedFile.data)) {
      bufferToSave = uploadedFile.data;
    } else {
      bufferToSave = Buffer.from(uploadedFile.data);
    }

    await INSERT.into('my.vendor.VendorPDFs').entries({
      ID: cds.utils.uuid(),
      fileName: uploadedFile.name,
      mimeType: mimeType,
      content: bufferToSave,
      fileCategory: fileCategory,  
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


    const newVendor = await INSERT.into('my.vendor.Vendors').entries({
      ID: ID,
      name: name,
      email: email,
      phone: phone
    });

    return newVendor;

  });
  const { Readable } = require('stream');
  function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', chunk => {
        console.log("Read chunk of size:", chunk.length); 
        chunks.push(chunk);
      });
      stream.on('end', () => {
        console.log("Stream ended. Total size:", Buffer.concat(chunks).length);  
        resolve(Buffer.concat(chunks));
      });
      stream.on('error', err => {
        console.error(" Error reading stream:", err);
        reject(err);
      });
    });
  }
  const archiver = require('archiver');
  

srv.on('download', async (req) => {
  const { vendor_ID } = req.data;

  if (!vendor_ID) {
    req._.res.status(400).json({ message: 'Missing vendor_ID' });
    return;
  }

  const files = await SELECT.from('my.vendor.VendorPDFs')
    .columns('ID', 'fileName', 'content', 'vendor_ID')
    .where({ vendor_ID });

  if (!files || files.length === 0) {
    req._.res.status(404).json({ message: 'No files found for this vendor' });
    return;
  }

  const zip = archiver('zip', {
    zlib: { level: 9 }
  });

  req._.res.setHeader('Content-Type', 'application/zip');
  req._.res.setHeader('Content-Disposition', `attachment; filename="vendor_${vendor_ID}.zip"`);

  zip.pipe(req._.res);

  for (const file of files) {
    let fileContent;

    if (Buffer.isBuffer(file.content)) {
      fileContent = file.content;
    } else if (typeof file.content === 'string') {
      fileContent = Buffer.from(file.content, 'base64');
    } else if (file.content instanceof Readable) {
      fileContent = await streamToBuffer(file.content);
    }

    zip.append(fileContent, { name: `vendor_${vendor_ID}/${file.fileName}` });
  }

  zip.finalize();
});

};
