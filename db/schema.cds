namespace my.vendor;

entity Vendors {
  key ID        : UUID;
  name          : String;
  email         : String;
  phone         : String;
  pdfs          : Association to many VendorPDFs on pdfs.vendor = $self;
}

entity VendorPDFs {
  key ID        : UUID;
  fileName      : String;
  mimeType      : String;
  content       : LargeBinary;
  createdAt     : Timestamp;
  vendor_ID     : String;
  vendor        : Association to Vendors on vendor.ID = vendor_ID;
}