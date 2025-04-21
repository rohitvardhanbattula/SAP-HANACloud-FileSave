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
  srv.on('download', async (req) => {
    const { vendor_ID } = req.data;

    console.log("Received vendor_ID:", vendor_ID);

    if (!vendor_ID) {
      req._.res.status(400).json({ message: 'Missing vendor_ID' });
      return;
    }

    const files = await SELECT.from('my.vendor.VendorPDFs')
      .columns('ID', 'fileName', 'content', 'vendor_ID')
      .where({ vendor_ID });

    console.log("Files fetched:", files);

    if (!files || files.length === 0) {
      req._.res.status(404).json({ message: 'No files found for this vendor' });
      return;
    }

    const file = files[0];
    const content = file.content;

    console.log("File content:", content);

    if (!content) {
      req._.res.status(400).json({ message: 'Invalid or missing file content' });
      return;
    }

    let pdfBuffer;

    try {
      if (Buffer.isBuffer(content)) {
        pdfBuffer = content;
      } else if (typeof content === 'string') {
        pdfBuffer = Buffer.from(content, 'base64');
      } else if (content instanceof Readable) {
        console.log(" Hit stream conversion");
        pdfBuffer = await streamToBuffer(content);
        console.log("Converted stream to buffer with size:", pdfBuffer.length);
      } else {
        req._.res.status(400).json({ message: 'Invalid or missing file content' });
        return;
      }

      console.log("Sending PDF with size:", pdfBuffer.length);

      req._.res.setHeader('Content-Type', 'application/pdf');
      req._.res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
      req._.res.send(pdfBuffer);
      console.log("File sent successfully"); 

    } catch (err) {
      console.error("Error processing the file:", err);
      req._.res.status(500).json({ message: 'Error processing the file content', error: err });
    }
  });
};
