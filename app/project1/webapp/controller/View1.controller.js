
sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/ui/model/json/JSONModel"
], function (Controller, MessageToast, JSONModel) {
  "use strict";

  return Controller.extend("project1.controller.View1", {

    onInit: function () {
      const oAttachModel = new JSONModel([]);
      this.getView().setModel(oAttachModel, "attachmentModel");
      fetch("/odata/v4/vendor/Vendors")
        .then(response => response.json())
        .then(data => {
          const oModel = new sap.ui.model.json.JSONModel(data.value);
          this.getView().setModel(oModel, "VendModel");
        })
        .catch(err => {
          console.error("Failed to fetch vendor PDFs:", err);
        });
    },
    onVendorSelect: function (oEvent) {
      const sVendorID = oEvent.getParameter("listItem")
        .getBindingContext("VendModel").getProperty("ID");
      const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
      oRouter.navTo("View2", {
        vendor_Id: sVendorID
      });
    }
    ,
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
      const status =this.byId("statusInput").getValue();

      if (!name || !email || !phone || !Id) {
        MessageToast.show("Please fill in all vendor details.");
        return;
      }


      try {

        const vendorPayload = {
          ID: Id,
          name: name,
          email: email,
          phone: phone,
          status:status
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

        if(this.selectedFiles.length>0){
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
      }

        MessageToast.show("Vendor and files uploaded successfully.");
        this.onInit();
        this.byId("idInput").setValue("");
        this.byId("nameInput").setValue("");
        this.byId("emailInput").setValue("");
        this.byId("phoneInput").setValue("");
        this.byId("statusInput").setValue("");
        this.byId("fileUploader").clear();

      } catch (err) {
        console.error("Error:", err);
        MessageToast.show("Error occurred during vendor or file upload.");
      }
    },
    onFilter: function () {
      const oTable = this.byId("vendorTable");
      const oBinding = oTable.getBinding("items");
    
      const idVal = this.byId("vendorIdFilter").getValue();
      const nameVal = this.byId("vendorNameFilter").getValue();
      const statusVal = this.byId("statusFilter").getValue();
    
      const filters = [];
    
      if (idVal) {
        filters.push(new sap.ui.model.Filter("ID", sap.ui.model.FilterOperator.Contains, idVal));
      }
      if (nameVal) {
        filters.push(new sap.ui.model.Filter("name", sap.ui.model.FilterOperator.Contains, nameVal));
      }
      if (statusVal) {
        filters.push(new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.Contains, statusVal));
      }
    
      oBinding.filter(filters);
    }
    
  });
});