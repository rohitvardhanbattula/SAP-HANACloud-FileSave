using {my.vendor as vendor} from '../db/schema';

service VendorService {
  entity Vendors    as projection on vendor.Vendors;
  entity VendorPDFs as projection on vendor.VendorPDFs;
  action   VendorCreation(ID : String,
                          name : String,
                          email : String,
                          phone : String)                     returns String;

  action   uploadPDF(vendorID : String)                          returns String;

  function download(vendor_ID : String)                          returns array of {
    fileName : String;
    content  : String;
    mimeType : String;
  };

  function VendorApprovals(vendor_ID : String)                          returns array of {
    level : String;
    approver_email  : String;
    status : String;
    comments: String;
  };

}