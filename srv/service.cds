using {my.vendor as vendor} from '../db/schema';

service VendorService {
  entity Vendors    as projection on vendor.Vendors;
  entity VendorPDFs as projection on vendor.VendorPDFs;

  action VendorCreation(ID : UUID,
                        name : String,
                        email : String,
                        phone : String) returns String;

  action uploadPDF(vendorID : UUID)     returns String;

  action download(vendor_ID : UUID)     returns array of {
    fileName : String;
    content : String;
  };
}
