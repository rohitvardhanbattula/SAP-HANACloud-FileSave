sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/core/BusyIndicator",
  "sap/ui/core/Fragment"
], function (Controller, MessageToast, JSONModel, Filter, FilterOperator, BusyIndicator, Fragment) {
  "use strict";

  return Controller.extend("project1.controller.View1", {
    _getUrl: function(){
      return sap.ui.require.toUrl("project1");
    },
    onInit: function () {
      const oAttachModel = new JSONModel([]);
      this.getView().setModel(oAttachModel, "attachmentModel");
      this._fetchVendors();

      this._intervalId = setInterval(() => {
        this._fetchVendors();
      }, 10000);

      this._createDialog = null;
      this.selectedFiles = null;
    },

    onExit: function () {
      if (this._intervalId) {
        clearInterval(this._intervalId);
        this._intervalId = null;
      }
    },

    _fetchVendors: function () {
      var sUrl = this._getUrl() + `/odata/v4/vendor/Vendors`;
      console.log(sUrl);
      fetch( sUrl )
        .then(response => response.json())
        .then(data => {
          const oModel = this.getView().getModel("VendModel");
          if (oModel) {
            oModel.setData(data.value);
          } else {
            this.getView().setModel(new JSONModel(data.value), "VendModel");
          }
          this._reapplyFilters();
        })
        .catch(err => {
          console.error("Failed to fetch vendors:", err);
        });
    },

    _reapplyFilters: function () {
      const oTable = this.byId("vendorTable");
      const oBinding = oTable.getBinding("items");

      const idVal = this.byId("vendorIdFilter").getValue();
      const nameVal = this.byId("vendorNameFilter").getValue();
      const statusVal = this.byId("statusFilter").getValue();

      const filters = [];
      if (idVal) filters.push(new Filter("ID", FilterOperator.Contains, idVal));
      if (nameVal) filters.push(new Filter("name", FilterOperator.Contains, nameVal));
      if (statusVal) filters.push(new Filter("status", FilterOperator.Contains, statusVal));

      oBinding.filter(filters);
    },

    onVendorSelect: function (oEvent) {
      const sVendorID = oEvent.getParameter("listItem")
        .getBindingContext("VendModel").getProperty("ID");
      const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
      oRouter.navTo("View2", {
        vendor_Id: sVendorID
      });
    },

    onCreateVendor: function () {
      if (!this._createDialog) {
        Fragment.load({
          name: "project1.view.CreateVendor",
          controller: this
        }).then(oDialog => {
          this._createDialog = oDialog;
          this.getView().addDependent(oDialog);
          oDialog.open();
        });
      } else {
        this._createDialog.open();
      }
    },

    onFileChange: function (oEvent) {
      this.selectedFiles = oEvent.getParameter("files");
      console.log("Selected files:", this.selectedFiles);
    },

    onCancelVendor: function () {
      this._createDialog.close();
    },

    onDialogClose: function () {
      // Clear inputs after dialog is closed
      sap.ui.getCore().byId("newVendorId").setValue("");
      sap.ui.getCore().byId("newVendorName").setValue("");
      sap.ui.getCore().byId("newVendorEmail").setValue("");
      sap.ui.getCore().byId("newVendorPhone").setValue("");
      sap.ui.getCore().byId("newFileUploader").clear();
      this.selectedFiles = null;
    },

    _isValidEmail: function (email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    _isValidPhone: function (phone) {
      return /^\d{10}$/.test(phone);
    },

    getCSRFToken: async function (url) {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: { "X-CSRF-Token": "Fetch" }
        });
        return response.headers.get("x-csrf-token");
      } catch (err) {
        console.error("CSRF Token fetch failed:", err);
        return null;
      }
    },

    onSubmitNewVendor: async function () {
      const Id = sap.ui.getCore().byId("newVendorId").getValue();
      const name = sap.ui.getCore().byId("newVendorName").getValue();
      const email = sap.ui.getCore().byId("newVendorEmail").getValue();
      const phone = sap.ui.getCore().byId("newVendorPhone").getValue();

      if (!name || !email || !phone || !Id || !this.selectedFiles || this.selectedFiles.length === 0) {
        MessageToast.show("Please fill in all vendor details and upload at least one file.");
        return;
      }

      if (!this._isValidEmail(email)) {
        MessageToast.show("Please enter a valid email address.");
        return;
      }

      if (!this._isValidPhone(phone)) {
        MessageToast.show("Please enter a valid 10-digit phone number.");
        return;
      }

      try {
        BusyIndicator.show(0);

        const vendorPayload = { ID: Id, name, email, phone };
        const csrfToken = await this.getCSRFToken("odata/v4/vendor/");
        const sUrl= this._getUrl()+ `/odata/v4/vendor/VendorCreation`;
        const response = await fetch(sUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken
          },
          body: JSON.stringify(vendorPayload)
        });

        if (!response.ok) throw new Error("Vendor creation failed: " + await response.text());

        for (let file of this.selectedFiles) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("vendorID", Id);
          const sUrl= this._getUrl()+ `/uploadPDF`;
          const uploadResponse = await fetch(sUrl, {
            method: "POST",
            body: formData
          });

          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload file: ${file.name}`);
          }
        }

        MessageToast.show("Vendor and file uploaded successfully.");
        this._createDialog.close();
        this.onDialogClose();
        await this._fetchVendors();

      } catch (err) {
        console.error("Error:", err);
        MessageToast.show("Error occurred during vendor or file upload.");
      } finally {
        BusyIndicator.hide();
      }
    },

    onFilter: function () {
      this._reapplyFilters();
    }
  });
});
