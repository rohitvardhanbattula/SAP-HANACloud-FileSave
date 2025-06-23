namespace my.vendor;

entity Vendors {
  key ID                : String;
      name              : String;
      email             : String;
      phone             : String;
      status            : String;
      approvercomments1 : String;
      approvercomments2 : String;
      pdfs              : Association to many VendorPDFs
                            on pdfs.vendor = $self;
}

entity VendorPDFs {
  key ID        : UUID;
      fileName  : String;
      mimeType  : String;
      content   : LargeString;
      createdAt : Timestamp;
      vendor_ID : String;
      vendor    : Association to Vendors
                    on vendor.ID = vendor_ID;
}
