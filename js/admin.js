(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.CarCareAuth.requireRole("admin")) return;
    const users = window.CarCareData.get("users");
    const models = window.CarCareData.get("vehicleModels");
    document.getElementById("admin-account-count").textContent = users.length;
    document.getElementById("admin-model-count").textContent = models.length;
    document.getElementById("admin-report-count").textContent = window.CarCareData.get("reports").length;
    document.getElementById("admin-accounts").innerHTML = users.map((user) =>
      "<tr><td><strong>" + window.CarCareUI.escapeHtml(user.name) + "</strong></td><td>" + window.CarCareUI.escapeHtml(user.role) + "</td><td>" + window.CarCareUI.escapeHtml(user.email) + "</td><td><span class=\"table-status\">Active demo</span></td></tr>"
    ).join("");
    document.getElementById("admin-models").innerHTML = models.map((model) =>
      "<span class=\"model-chip\">" + window.CarCareUI.escapeHtml(model.year + " " + model.make + " " + model.model) + "</span>"
    ).join("");
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
