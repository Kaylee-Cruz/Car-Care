(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    const session = window.CarCareAuth.requireRole("owner");
    if (!session) return;
    const vehicle = window.CarCareData.vehicles.find((item) => item.ownerId === session.id);
    const parts = vehicle ? vehicle.parts : [];
    const history = window.CarCareData.serviceHistory.filter((item) => item.ownerId === session.id);
    document.getElementById("vehicle-summary").textContent = vehicle ? vehicle.year + " " + vehicle.vehicleMake + " " + vehicle.carModel : "No vehicle yet";
    document.getElementById("parts-count").textContent = parts.length;
    document.getElementById("attention-count").textContent = parts.filter((part) => part.status !== "Good").length;
    document.getElementById("owner-parts").innerHTML = parts.map((part) => {
      const statusClass = part.status === "Due" || part.status === "Expired" ? "expired" : part.status === "Good" ? "" : "due";
      return "<tr><td><strong>" + window.CarCareUI.escapeHtml(part.name) + "</strong></td><td><span class=\"table-status " + statusClass + "\">" + window.CarCareUI.escapeHtml(part.status) + "</span></td><td>" + window.CarCareUI.formatDate(part.expiryDate) + "</td></tr>";
    }).join("") || "<tr><td colspan=\"3\">No parts have been recorded.</td></tr>";
    document.getElementById("owner-history").innerHTML = history.map((item) =>
      "<div class=\"history-item\"><span class=\"history-icon\">✓</span><span class=\"history-copy\"><strong>" + window.CarCareUI.escapeHtml(item.parts.join(", ")) + "</strong><small>" + window.CarCareUI.escapeHtml(item.center) + " · " + window.CarCareUI.formatDate(item.date) + "</small></span><span class=\"history-cost\">$" + Number(item.cost).toFixed(2) + "</span></div>"
    ).join("") || "<div class=\"empty-state\">No service history recorded yet.</div>";
  });
}());
