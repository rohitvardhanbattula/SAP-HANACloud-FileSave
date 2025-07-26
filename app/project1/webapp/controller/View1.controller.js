sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/BusyDialog"
], function (Controller, MessageToast, JSONModel, Filter, FilterOperator, BusyDialog) {
  "use strict";

  return Controller.extend("project1.controller.View1", {

    onInit: function () {
      const oAttachModel = new JSONModel([]);
      this.getView().setModel(oAttachModel, "attachmentModel");

      // Busy Dialog for Upload
      this.oBusyDialog = new BusyDialog({
        title: "Processing",
        text: "Please wait while we upload your vendor and files..."
      });

      this._fetchVendors();

      setInterval(() => {
        this._fetchVendors();
      }, 10000);
    },

    _fetchVendors: function () {
      fetch("odata/v4/vendor/Vendors")
        .then(response => response.json())
        .then(data => {
          const oModel = new JSONModel(data.value);
          this.getView().setModel(oModel, "VendModel");
        })
        .catch(err => {
          console.error("Failed to fetch vendors:", err);
        });
    },

    onVendorSelect: function (oEvent) {
      const sVendorID = oEvent.getParameter("listItem")
        .getBindingContext("VendModel").getProperty("ID");
      const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
      oRouter.navTo("View2", {
        vendor_Id: sVendorID
      });
    },

    onFileChange: function (oEvent) {
      const files = oEvent.getParameter("files");
      this.selectedFiles = files;
      console.log(this.selectedFiles);
    },

    getCSRFToken: async function (url) {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-CSRF-Token": "Fetch"
        }
      });

      const token = response.headers.get("x-csrf-token");
      return token;
    },

    onSubmit: async function () {
      const Id = this.byId("idInput").getValue();
      const name = this.byId("nameInput").getValue();
      const email = this.byId("emailInput").getValue();
      const phone = this.byId("phoneInput").getValue();

      if (!name || !email || !phone || !Id || !this.selectedFiles || this.selectedFiles.length === 0) {
        MessageToast.show("Please fill in all vendor details and upload at least one file.");
        return;
      }

      try {
        // Show BusyDialog
        this.oBusyDialog.setText("Creating Vendor...");
        this.oBusyDialog.open();

        const vendorPayload = {
          ID: Id,
          name: name,
          email: email,
          phone: phone
        };

        // Get CSRF Token for OData service
        const csrfToken = await this.getCSRFToken("odata/v4/vendor/");

        // Vendor creation
        const response = await fetch("odata/v4/vendor/VendorCreation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken
          },
          body: JSON.stringify(vendorPayload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error("Vendor creation failed: " + errorText);
        }

        const vendorID = Id;

        // Upload files
        for (let i = 0; i < this.selectedFiles.length; i++) {
          const file = this.selectedFiles[i];
          this.oBusyDialog.setText(`Uploading file ${i + 1} of ${this.selectedFiles.length}...`);

          const formData = new FormData();
          formData.append("file", file);
          formData.append("vendorID", vendorID);

          const uploadResponse = await fetch("uploadPDF", {
            method: "POST",
            body: formData
          });

          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload file: ${file.name}`);
          }
        }

        MessageToast.show("Vendor and file uploaded successfully.");
        this.onInit();

        // Clear form
        this.byId("idInput").setValue("");
        this.byId("nameInput").setValue("");
        this.byId("emailInput").setValue("");
        this.byId("phoneInput").setValue("");
        this.byId("fileUploader").clear();
        this.oBusyDialog.close(); 
        this.selectedFiles = null;

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
        filters.push(new Filter("ID", FilterOperator.Contains, idVal));
      }
      if (nameVal) {
        filters.push(new Filter("name", FilterOperator.Contains, nameVal));
      }
      if (statusVal) {
        filters.push(new Filter("status", FilterOperator.Contains, statusVal));
      }

      oBinding.filter(filters);
    }
  });
});
