sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel"
  ], function (Controller, MessageToast, JSONModel) {
    "use strict";
  
    return Controller.extend("project1.controller.View2", {
  
      onInit: function () {
        const oRouter = this.getOwnerComponent().getRouter();
        var oRoute = oRouter.getRoute("View2");if (oRoute) {
            oRoute.attachPatternMatched(this._onRouteMatched, this);
          } else {
            console.error("Route 'View2' not found! Check manifest.json for routing config.");
          }
         
      },
      _approvers: function (vendorId) {
        
        
      
        fetch(`/odata/v4/vendor/VendorApprovals?vendor_ID=${vendorId}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" }
        })
          .then(res => res.json())
          .then(data => {
            const sorted = data.value.sort((a, b) => a.level - b.level);
      
            
            const oApprovalModel = new JSONModel(sorted);
            this.getView().setModel(oApprovalModel, "VendModel1");
      
            this.byId("busyIndicator").setVisible(false);
          })
          .catch(err => {
            console.error("Approvals fetch error:", err);
            MessageToast.show("Failed to fetch vendor approval data.");
            this.byId("busyIndicator").setVisible(false);
          });
      }
      
,      
      _onRouteMatched: function (oEvent) {
        const vendorId = oEvent.getParameter("arguments").vendor_Id;
      
        this.byId("vendorIdText").setText("Vendor ID: " + vendorId);
        this.byId("busyIndicator").setVisible(true);
      
        // Attachments fetch
        this.getView().setModel(new JSONModel({ files: [] }), "attachmentModel");
        fetch(`/odata/v4/vendor/download?vendor_ID=${vendorId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json"
          }
        })
          .then(res => res.json())
          .then(data => {
            const oModel = new JSONModel({ files: data.value });
            this.getView().setModel(oModel, "attachmentModel");
            this.byId("busyIndicator").setVisible(false);
          })
          .catch(err => {
            console.error("Error:", err);
            MessageToast.show("Failed to fetch files.");
            this.byId("busyIndicator").setVisible(false);
          });
      
       
        this._approvers(vendorId);
      
        
        clearInterval(this._approverInterval); 
        this._approverInterval = setInterval(() => {
          this._approvers(vendorId);
        }, 10000);
      }
      ,
  
      onDownloadPress: function (oEvent) {
        const oContext = oEvent.getSource().getBindingContext("attachmentModel");
        const { fileName, content, mimeType } = oContext.getProperty();
  
        const byteChars = atob(content);
        const byteNumbers = Array.from(byteChars, c => c.charCodeAt(0));
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });  
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },
      onDownloadAll: function () {
        const aFiles = this.getView().getModel("attachmentModel").getProperty("/files");
      
        if (!aFiles || !aFiles.length) {
          sap.m.MessageToast.show("No files to download.");
          return;
        }
        const zip = new JSZip();
        aFiles.forEach(file => {
          const byteChars = atob(file.content);
          const byteArray = new Uint8Array([...byteChars].map(c => c.charCodeAt(0)));
          zip.file(file.fileName, byteArray, { binary: true });
        });
      
        zip.generateAsync({ type: "blob" }).then(blob => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "attachments.zip";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        });
      }
      
    });
  });
  