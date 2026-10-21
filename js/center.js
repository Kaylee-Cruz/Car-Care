(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    const session = window.CarCareAuth.requireRole("center");
    if (!session) return;
    const centerId = session.serviceCenterId;
    const vehicles = window.CarCareData.get("vehicles").filter((vehicle) => vehicle.assignedCenterId === centerId);
    const vehicleIds = new Set(vehicles.map((vehicle) => vehicle.id));
    const ownersById = new Map(window.CarCareData.get("users").filter((user) => user.role === "owner").map((user) => [user.id, user.ownerName]));
    const inventory = window.CarCareData.get("inventory").filter((item) => item.serviceCenterId === centerId);
    const shipments = window.CarCareData.get("shipments").filter((shipment) => shipment.serviceCenterId === centerId);
    const parts = window.CarCareData.get("parts").filter((part) => vehicleIds.has(part.vehicleId));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    function getStatus(expiryDate) {
      const expiry = new Date(expiryDate + "T00:00:00");
      const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
      if (daysLeft < 0) return "Expired";
      if (daysLeft <= 30) return "Due soon";
      return null;
    }

    const reminders = parts.map((part) => {
      const vehicle = vehicles.find((item) => item.id === part.vehicleId);
      return { part, vehicle, status: getStatus(part.expiryDate) };
    }).filter((reminder) => reminder.status);

    document.getElementById("follow-up-count").textContent = reminders.length;
    document.getElementById("inventory-count").textContent = inventory.reduce((total, item) => total + item.quantity, 0);
    document.getElementById("shipment-count").textContent = shipments.length;
    document.getElementById("center-reminders").innerHTML = reminders.map(({ part, vehicle, status }) => {
      const statusClass = status === "Expired" ? "expired" : "due";
      return "<tr><td><strong>" + window.CarCareUI.escapeHtml(ownersById.get(vehicle.ownerId) || "Vehicle owner") + "</strong></td><td>" + window.CarCareUI.escapeHtml(vehicle.year + " " + vehicle.vehicleMake + " " + vehicle.carModel) + "</td><td>" + window.CarCareUI.escapeHtml(part.partName) + "</td><td><span class=\"table-status " + statusClass + "\">" + status + "</span></td></tr>";
    }).join("") || "<tr><td colspan=\"4\">No vehicles currently need follow-up.</td></tr>";
    document.getElementById("center-inventory").innerHTML = inventory.map((item) =>
      "<div class=\"inventory-item\"><strong>" + window.CarCareUI.escapeHtml(item.partName) + "</strong><small>SKU " + window.CarCareUI.escapeHtml(item.sku) + " · " + item.quantity + " in stock (reorder at " + item.reorderLevel + ")</small><small>$" + Number(item.unitPrice).toFixed(2) + " per unit</small></div>"
    ).join("") || "<div class=\"empty-state\">No inventory recorded for this service center.</div>";
    document.getElementById("center-shipments").innerHTML = shipments.map((item) =>
      "<div class=\"history-item\"><span class=\"history-icon\">⇄</span><span class=\"history-copy\"><strong>" + window.CarCareUI.escapeHtml(item.item) + " · " + item.quantity + " units</strong><small>" + window.CarCareUI.escapeHtml(item.status) + " · " + window.CarCareUI.formatDate(item.expectedDate) + "</small></span></div>"
    ).join("") || "<div class=\"empty-state\">No shipments scheduled.</div>";
  });
}());
