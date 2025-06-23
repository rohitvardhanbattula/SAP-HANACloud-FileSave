using {my.vendor as vendor} from '../db/schema';

service VendorService {
  entity Vendors    as projection on vendor.Vendors;
  entity VendorPDFs as projection on vendor.VendorPDFs;

  action   VendorCreation(ID : String,
                          name : String,
                          email : String,
                          phone : String,
                          status : String)                     returns String;

  action   uploadPDF(vendorID : String)                          returns String;

  function download(vendor_ID : String)                          returns array of {
    fileName : String;
    content  : String;
    mimeType : String;
  };

  function getdetails(name : String)                               returns array of {
    status            : String;
    approvercomments1 : String;
    approvercomments2 : String;
  };

  function getIds()                                            returns array of {
    ID : String;
  };

  action   updateApproverComments1(ID : String,
                                   approvercomments1 : String) returns String;


  action   updateApproverComments2(ID : String,
                                   approvercomments2 : String) returns String;
}