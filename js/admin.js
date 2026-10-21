(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.CarCareAuth.requireRole("admin")) return;
    const users = window.CarCareData.get("users");
    const models = window.CarCareData.get("vehicleModels");
    const reports = window.CarCareData.get("reports").slice().sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    document.getElementById("admin-account-count").textContent = users.length;
    document.getElementById("admin-model-count").textContent = models.length;
    document.getElementById("admin-report-count").textContent = reports.length;
    document.getElementById("admin-accounts").innerHTML = users.map((user) =>
      "<tr><td><strong>" + window.CarCareUI.escapeHtml(user.name) + "</strong></td><td>" + window.CarCareUI.escapeHtml(user.role) + "</td><td>" + window.CarCareUI.escapeHtml(user.email) + "</td></tr>"
    ).join("");
    document.getElementById("admin-models").innerHTML = models.map((model) =>
      "<span class=\"model-chip\">" + window.CarCareUI.escapeHtml(model.year + " " + model.make + " " + model.model) + "</span>"
    ).join("");
    const reportsTarget = document.getElementById("admin-reports");
    const serviceRequests = window.CarCareData.get("serviceRequests");
    const vehicles = window.CarCareData.get("vehicles");
    reportsTarget.innerHTML = reports.length ? reports.map((report) => {
      const owner = users.find((user) => user.id === report.ownerId);
      const request = serviceRequests.find((item) => item.id === report.serviceRequestId);
      const vehicle = vehicles.find((item) => item.id === (request || {}).vehicleId);
      const centerName = window.CarCareData.getServiceCenterName(report.serviceCenterId) || "Service center";
      const type = report.type === "complaint" ? "Complaint" : "Positive Feedback";
      return "<article class=\"admin-report-card\"><div class=\"admin-report-heading\"><div><p class=\"eyebrow\">" + window.CarCareUI.escapeHtml(type) + "</p><h3>" + window.CarCareUI.escapeHtml(report.orderNumber || "Service report") + "</h3></div><span class=\"admin-report-rating\">" + "★".repeat(Math.max(0, Math.min(5, Number(report.rating) || 0))) + "<small> " + Number(report.rating) + "/5</small></span></div><p class=\"admin-report-message\">" + window.CarCareUI.escapeHtml(report.message) + "</p><div class=\"admin-report-meta\"><span>From " + window.CarCareUI.escapeHtml(owner ? owner.ownerName || owner.name : "Owner") + "</span><span>" + window.CarCareUI.escapeHtml(vehicle ? vehicle.year + " " + vehicle.vehicleMake + " " + vehicle.carModel + " · " + vehicle.vehicleNumber : "Vehicle") + "</span><span>" + window.CarCareUI.escapeHtml(centerName) + "</span><span>" + window.CarCareUI.formatDate(String(report.createdAt || "").slice(0, 10)) + "</span></div></article>";
    }).join("") : "<div class=\"center-empty-state\">No owner reports have been submitted yet.</div>";
    document.querySelector("[data-reset-demo]").addEventListener("click", function () {
      if (!window.confirm("Reset all Car Care demo data to the original seed?")) return;
      try {
        window.CarCareData.resetDemoData();
        window.location.reload();
      } catch (error) {
        window.CarCareUI.toast(error.message, "error");
      }
    });
  });
}());
