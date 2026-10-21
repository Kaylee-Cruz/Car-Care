(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.CarCareAuth.requireRole("admin")) return;
    const users = window.CarCareData.users;
    const models = window.CarCareData.vehicleModels;
    document.getElementById("admin-account-count").textContent = users.length;
    document.getElementById("admin-model-count").textContent = models.length;
    document.getElementById("admin-report-count").textContent = window.CarCareData.reports.length;
    document.getElementById("admin-accounts").innerHTML = users.map((user) =>
      "<tr><td><strong>" + window.CarCareUI.escapeHtml(user.name) + "</strong></td><td>" + window.CarCareUI.escapeHtml(user.role) + "</td><td>" + window.CarCareUI.escapeHtml(user.email) + "</td><td><span class=\"table-status\">Active demo</span></td></tr>"
    ).join("");
    document.getElementById("admin-models").innerHTML = models.map((model) =>
      "<span class=\"model-chip\">" + window.CarCareUI.escapeHtml(model) + "</span>"
    ).join("");
  });
}());
