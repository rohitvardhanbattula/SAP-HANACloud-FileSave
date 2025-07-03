namespace my.vendor;

entity Vendors {
  key ID                : String;
      name              : String;
      email             : String;
      phone             : String;
      status            : String;
      uploadTime        : Timestamp;
      bpaTriggered      : Boolean default false;
      pdfs              : Association to many VendorPDFs on pdfs.vendor = $self;
      approvals         : Association to many VendorApprovals on approvals.vendor = $self;
}

entity VendorPDFs {
  key ID        : UUID;
      fileName  : String;
      mimeType  : String;
      content   : LargeString;
      createdAt : Timestamp;
      vendor_ID : String;
      vendor    : Association to Vendors on vendor.ID = vendor_ID;
}

entity VendorApprovals {
  key ID              : UUID;
      vendor_ID       : String;
      vendor          : Association to Vendors on vendor.ID = vendor_ID;
      level           : String;
      approver_email  : String;
      approver_name   : String;
      status          : String;
      comments        : String;
      updatedAt       : Timestamp;
}

entity Approvers {
  key ID        : UUID;
  level         : String; 
  approver_email  : String(100);
}
