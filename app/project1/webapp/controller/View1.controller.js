sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/ui/model/json/JSONModel"
], function (Controller, MessageToast, JSONModel) {
  "use strict";

  return Controller.extend("project1.controller.View1", {

    onInit: function () {

    },

    onFileChange: function (oEvent) {

      const files = oEvent.getParameter("files");


      this.selectedFiles = files;


      console.log(this.selectedFiles);
    },

    onSubmit: async function () {
      const Id = this.byId("idInput").getValue();
      const name = this.byId("nameInput").getValue();
      const email = this.byId("emailInput").getValue();
      const phone = this.byId("phoneInput").getValue();

      if (!name || !email || !phone || !Id) {
        MessageToast.show("Please fill in all vendor details.");
        return;
      }

      if (!this.selectedFiles || this.selectedFiles.length === 0) {
        MessageToast.show("Please select at least one file to upload.");
        return;
      }


      try {

        const vendorPayload = {
          ID: Id,
          name: name,
          email: email,
          phone: phone
        };

        const response = await fetch("/odata/v2/vendor/VendorCreation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(vendorPayload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error("Vendor creation failed: " + errorText);
        }

        const vendorID = Id;


        for (let i = 0; i < this.selectedFiles.length; i++) {
          const file = this.selectedFiles[i];
          const formData = new FormData();
          formData.append("file", file);
          formData.append("vendorID", vendorID);

          const response = await fetch("/uploadPDF", {
            method: "POST",
            body: formData
          });

          if (!response.ok) {
            throw new Error(`Failed to upload file: ${file.name}`);
          }
        }

        MessageToast.show("Vendor and files uploaded successfully.");

        this.byId("idInput").setValue("");
        this.byId("nameInput").setValue("");
        this.byId("emailInput").setValue("");
        this.byId("phoneInput").setValue("");
        this.byId("fileUploader").clear();

      } catch (err) {
        console.error("Error:", err);
        MessageToast.show("Error occurred during vendor or file upload.");
      }
    },
    onDownload: function () {
      const vendorId = this.byId("vendorIdDownload").getValue();
      
      fetch(`/odata/v4/vendor/download`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ vendor_ID: vendorId })
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Failed to download file");
          }
    
          const contentDisposition = response.headers.get("Content-Disposition");
          let filename = `vendor_${vendorId}.zip`;
          if (contentDisposition && contentDisposition.includes("filename=")) {
            filename = contentDisposition.split("filename=")[1].replace(/"/g, "");
          }
    
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
    
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        })
        .catch((err) => {
          console.error("Error downloading file:", err);
          sap.m.MessageToast.show("Failed to download file");
        });
    
      this.byId("vendorIdDownload").setValue("");
    }
    

  });
});