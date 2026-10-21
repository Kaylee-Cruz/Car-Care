(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.CarCareAuth.requireRole("center")) return;
    const reminders = window.CarCareData.centerReminders;
    const inventory = window.CarCareData.inventory;
    const shipments = window.CarCareData.shipments;
    document.getElementById("follow-up-count").textContent = reminders.length;
    document.getElementById("inventory-count").textContent = inventory.reduce((total, item) => total + item.stock, 0);
    document.getElementById("shipment-count").textContent = shipments.length;
    document.getElementById("center-reminders").innerHTML = reminders.map((item) => {
      const statusClass = item.status === "Due" ? "expired" : "due";
      return "<tr><td><strong>" + window.CarCareUI.escapeHtml(item.owner) + "</strong></td><td>" + window.CarCareUI.escapeHtml(item.vehicle) + "</td><td>" + window.CarCareUI.escapeHtml(item.part) + "</td><td><span class=\"table-status " + statusClass + "\">" + window.CarCareUI.escapeHtml(item.status) + "</span></td></tr>";
    }).join("");
    document.getElementById("center-inventory").innerHTML = inventory.map((item) =>
      "<div class=\"inventory-item\"><strong>" + window.CarCareUI.escapeHtml(item.name) + "</strong><small>" + item.stock + " " + window.CarCareUI.escapeHtml(item.unit) + " in stock</small></div>"
    ).join("");
    document.getElementById("center-shipments").innerHTML = shipments.map((item) =>
      "<div class=\"history-item\"><span class=\"history-icon\">⇄</span><span class=\"history-copy\"><strong>" + window.CarCareUI.escapeHtml(item.item) + " · " + item.quantity + " units</strong><small>" + window.CarCareUI.escapeHtml(item.status) + " · " + window.CarCareUI.formatDate(item.date) + "</small></span></div>"
    ).join("");
  });
}());
