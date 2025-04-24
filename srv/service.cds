using {my.vendor as vendor} from '../db/schema';

service VendorService {
  entity Vendors    as projection on vendor.Vendors;
  entity VendorPDFs as projection on vendor.VendorPDFs;

  action VendorCreation(ID : UUID,
                        name : String,
                        email : String,
                        phone : String,
                        status : String) returns String;

  action uploadPDF(vendorID : UUID)     returns String;

  function download(vendor_ID : UUID)     returns array of {
    fileName : String;
    content : String;
    mimeType : String;
  };
}
