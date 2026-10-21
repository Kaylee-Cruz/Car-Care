(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    const session = window.CarCareAuth.requireRole("owner");
    if (!session) return;
    const vehicle = window.CarCareData.get("vehicles").find((item) => item.ownerId === session.id);
    const parts = vehicle ? window.CarCareData.get("parts").filter((part) => part.vehicleId === vehicle.id) : [];
    const history = window.CarCareData.get("serviceHistory").filter((item) => item.ownerId === session.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    function getStatus(expiryDate) {
      const expiry = new Date(expiryDate + "T00:00:00");
      const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
      if (daysLeft < 0) return "Expired";
      if (daysLeft <= 30) return "Due soon";
      return "Good";
    }

    document.getElementById("vehicle-summary").textContent = vehicle ? vehicle.year + " " + vehicle.vehicleMake + " " + vehicle.carModel : "No vehicle yet";
    document.getElementById("parts-count").textContent = parts.length;
    document.getElementById("attention-count").textContent = parts.filter((part) => getStatus(part.expiryDate) !== "Good").length;
    document.getElementById("owner-parts").innerHTML = parts.map((part) => {
      const status = getStatus(part.expiryDate);
      const statusClass = status === "Expired" ? "expired" : status === "Good" ? "" : "due";
      return "<tr><td><strong>" + window.CarCareUI.escapeHtml(part.partName) + "</strong><small class=\"table-subtext\">Installed " + window.CarCareUI.formatDate(part.installDate) + "</small></td><td><span class=\"table-status " + statusClass + "\">" + status + "</span></td><td>" + window.CarCareUI.formatDate(part.expiryDate) + "</td></tr>";
    }).join("") || "<tr><td colspan=\"3\">No parts have been recorded.</td></tr>";
    document.getElementById("owner-history").innerHTML = history.map((item) =>
      "<div class=\"history-item\"><span class=\"history-icon\">✓</span><span class=\"history-copy\"><strong>" + window.CarCareUI.escapeHtml(item.partsChanged.join(", ")) + "</strong><small>" + window.CarCareUI.escapeHtml(item.serviceCenterName) + " · " + window.CarCareUI.formatDate(item.date) + "</small></span><span class=\"history-cost\">$" + Number(item.cost).toFixed(2) + "</span></div>"
    ).join("") || "<div class=\"empty-state\">No service history recorded yet.</div>";
  });
}());
