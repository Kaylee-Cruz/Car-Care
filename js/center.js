(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    const session = window.CarCareAuth.requireRole("center");
    if (!session) return;

    const centerId = session.serviceCenterId;
    const escape = window.CarCareUI.escapeHtml;
    let activeRequestId = null;

    function getData(collection) {
      return window.CarCareData.get(collection);
    }

    function saveData(collection, records) {
      window.CarCareData.save(collection, records);
    }

    function centerUsers() {
      return getData("users").filter((user) => user.serviceCenterId === centerId && ["center", "manager", "technician"].includes(user.role));
    }

    function centerVehicles() {
      const ownerIds = new Set(getData("users").filter((user) => user.role === "owner").map((user) => user.id));
      return getData("vehicles").filter((vehicle) => vehicle.assignedCenterId === centerId || (
        ownerIds.has(vehicle.ownerId) && getData("serviceRequests").some((request) => request.serviceCenterId === centerId && request.vehicleId === vehicle.id)
      ));
    }

    function requestsForCenter() {
      return getData("serviceRequests").filter((request) => request.serviceCenterId === centerId);
    }

    function ownerFor(id) {
      const owner = getData("users").find((user) => user.id === id && user.role === "owner");
      if (!owner) return null;
      return {
        name: owner.ownerName || owner.name || "Vehicle owner",
        phone: owner.phone || "Not provided",
        address: owner.address || "Not provided",
        vehicles: centerVehicles().filter((vehicle) => vehicle.ownerId === owner.id).map(vehicleLabel)
      };
    }

    function vehicleFor(id) {
      return centerVehicles().find((vehicle) => vehicle.id === id);
    }

    function vehicleLabel(vehicle) {
      return vehicle ? vehicle.year + " " + vehicle.vehicleMake + " " + vehicle.carModel : "Vehicle unavailable";
    }

    function localDate(date) {
      return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
    }

    function todayString() {
      return localDate(new Date());
    }

    function dateDiff(value) {
      if (!value) return null;
      const parsed = new Date(value + "T00:00:00");
      if (Number.isNaN(parsed.getTime())) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return Math.ceil((parsed.getTime() - today.getTime()) / 86400000);
    }

    function partState(part) {
      const days = dateDiff(part.expiryDate);
      if (days === null) return { days: null, status: "Unknown", className: "due" };
      if (days < 0) return { days, status: "Expired", className: "expired" };
      if (days <= 30) return { days, status: "Due soon", className: "due" };
      return { days, status: "OK", className: "ok" };
    }

    function statusLabel(status) {
      return ({
        requested: "Requested",
        "accepted-by-owner": "Accepted by Owner",
        "car-picked-up": "Car Picked Up",
        "inspection-pending": "Car Picked Up",
        "estimate-ready": "Estimate Sent",
        "estimate-sent": "Estimate Sent",
        "parts-confirmed": "Parts Confirmed",
        "in-service": "In Service",
        completed: "Completed",
        "service-completed": "Completed",
        paid: "Paid",
        declined: "Declined",
        cancelled: "Cancelled"
      })[status] || "Requested";
    }

    function statusClass(status) {
      if (["completed", "service-completed", "paid"].includes(status)) return "ok";
      if (["declined", "cancelled"].includes(status)) return "expired";
      if (["requested", "accepted-by-owner", "car-picked-up", "inspection-pending"].includes(status)) return "due";
      return "due";
    }

    function formatTime(value) {
      if (!value) return "Not scheduled";
      const match = /^(\d{2}):(\d{2})$/.exec(value);
      if (!match) return value;
      const hours = Number(match[1]);
      return (hours % 12 || 12) + ":" + match[2] + " " + (hours >= 12 ? "PM" : "AM");
    }

    function customerMarkup(owner) {
      if (!owner) return "<div class=\"center-customer\"><strong>Vehicle owner</strong><small>Customer profile unavailable</small></div>";
      return "<div class=\"center-customer\"><strong>" + escape(owner.name) + "</strong><small>" + escape(owner.phone) + "</small><small>" + escape(owner.address) + "</small>" +
        (owner.vehicles.length ? "<small>Vehicles: " + escape(owner.vehicles.join(", ")) + "</small>" : "") + "</div>";
    }

    function notifyOwner(ownerId, request, type, message) {
      const notifications = getData("notifications");
      const notificationKey = "center-" + type + "-" + request.id + "-" + (request.updatedAt || request.status);
      if (notifications.some((item) => item.notificationKey === notificationKey)) return;
      notifications.push({
        id: "notification-" + notificationKey,
        notificationKey,
        recipientId: ownerId,
        type,
        message,
        relatedId: request.id,
        createdAt: new Date().toISOString(),
        read: false,
        simulated: true
      });
      saveData("notifications", notifications);
    }

    function writeRequest(requestId, update) {
      const requests = getData("serviceRequests");
      const current = requests.find((request) => request.id === requestId && request.serviceCenterId === centerId);
      if (!current) throw new Error("This service request is no longer available to your center.");
      const next = Object.assign({}, current, update, { updatedAt: new Date().toISOString() });
      saveData("serviceRequests", requests.map((request) => request.id === requestId ? next : request));
      return next;
    }

    function allActiveRequests() {
      return requestsForCenter().filter((request) => !["completed", "service-completed", "paid", "declined", "cancelled"].includes(request.status));
    }

    function statusCountMarkup() {
      const requests = allActiveRequests();
      const statuses = [
        ["requested", "Awaiting owner"],
        ["accepted-by-owner", "Accepted"],
        ["car-picked-up", "Picked up"],
        ["estimate-ready", "Estimate sent"],
        ["parts-confirmed", "Confirmed"],
        ["in-service", "In service"]
      ];
      document.getElementById("request-status-counts").innerHTML = statuses.map(([status, label]) => {
        const count = requests.filter((request) => request.status === status || (status === "car-picked-up" && request.status === "inspection-pending") || (status === "estimate-ready" && request.status === "estimate-sent")).length;
        return "<article class=\"center-summary-card\"><small>" + label + "</small><strong>" + count + "</strong></article>";
      }).join("");
      document.getElementById("request-nav-count").textContent = String(requests.length);
    }

    function urgencyItems() {
      const vehicles = centerVehicles();
      const parts = getData("parts");
      return vehicles.map((vehicle) => {
        const attention = parts.filter((part) => part.vehicleId === vehicle.id).map((part) => ({ part, state: partState(part) }))
          .filter((item) => item.state.days !== null && item.state.days <= 30)
          .sort((left, right) => left.state.days - right.state.days);
        return { vehicle, owner: ownerFor(vehicle.ownerId), attention };
      }).filter((item) => item.attention.length)
        .sort((left, right) => left.attention[0].state.days - right.attention[0].state.days);
    }

    function renderFollowups() {
      const items = urgencyItems();
      document.getElementById("follow-up-count").textContent = String(items.length);
      document.getElementById("center-followups").innerHTML = items.length ? items.map(({ vehicle, owner, attention }) => {
        const urgency = attention.some(({ state }) => state.days < 0);
        const openRequest = requestsForCenter().some((request) =>
          request.vehicleId === vehicle.id && !["completed", "service-completed", "paid", "declined", "cancelled"].includes(request.status)
        );
        return "<article class=\"center-followup-card\"><div class=\"center-followup-main\"><div><span class=\"table-status " + (urgency ? "expired" : "due") + "\">" + (urgency ? "Needs attention now" : "Due within 30 days") + "</span><h3>" + escape(vehicleLabel(vehicle)) + " <small>" + escape(vehicle.vehicleNumber) + "</small></h3>" + customerMarkup(owner) + "</div><div class=\"center-due-parts\">" + attention.map(({ part, state }) =>
          "<span class=\"center-part-chip " + state.className + "\">" + escape(part.partName) + " · " + (state.days < 0 ? Math.abs(state.days) + "d overdue" : state.days === 0 ? "due today" : state.days + "d") + "</span>"
        ).join("") + "</div></div><div class=\"center-followup-actions\">" + (openRequest
          ? "<span class=\"center-inline-note\">An open request already exists for this vehicle.</span>"
          : "<button class=\"button button-primary button-small\" type=\"button\" data-send-request=\"" + escape(vehicle.id) + "\">Send Service Request</button>") + "</div></article>";
      }).join("") : "<div class=\"center-empty-state\">No assigned vehicles have parts due within 30 days.</div>";
    }

    function requestRows(requests, compact) {
      if (!requests.length) return "<tr><td colspan=\"" + (compact ? "5" : "6") + "\" class=\"center-table-empty\">No service requests for this center yet.</td></tr>";
      return requests.map((request) => {
        const vehicle = vehicleFor(request.vehicleId);
        const owner = ownerFor(request.ownerId);
        const pickup = request.pickupDate ? window.CarCareUI.formatDate(request.pickupDate) + " · " + formatTime(request.pickupTime) : "Not scheduled";
        return "<tr><td><strong>" + escape(request.orderNumber || request.id) + "</strong></td><td>" + escape(owner ? owner.name : "Vehicle owner") + "</td><td>" + escape(vehicleLabel(vehicle)) + "</td>" +
          (compact ? "" : "<td>" + escape(pickup) + "</td>") +
          "<td><span class=\"table-status " + statusClass(request.status) + "\">" + escape(statusLabel(request.status)) + "</span></td><td><button class=\"link-button\" type=\"button\" data-open-request=\"" + escape(request.id) + "\">Open details</button></td></tr>";
      }).join("");
    }

    function sortRequests(requests) {
      return requests.slice().sort((left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0));
    }

    function renderRequests() {
      const requests = sortRequests(requestsForCenter());
      document.getElementById("center-requests-table").innerHTML = requestRows(requests, false);
      document.getElementById("dashboard-requests").innerHTML = requestRows(requests.slice(0, 5), true);
      statusCountMarkup();
      if (activeRequestId && requests.some((request) => request.id === activeRequestId)) renderRequestDetail(activeRequestId);
    }

    function inventoryPrice(partName) {
      const items = getData("inventory").filter((item) => item.serviceCenterId === centerId);
      const needle = partName.toLowerCase();
      const keywords = needle.includes("oil") ? ["oil"] : needle.includes("brake") ? ["brake"] :
        needle.includes("tire") ? ["tire"] : needle.includes("battery") ? ["battery"] :
          needle.includes("filter") ? ["filter"] : needle.includes("belt") ? ["belt"] : [needle];
      const match = items.find((item) => keywords.some((keyword) => item.partName.toLowerCase().includes(keyword)));
      return match ? Number(match.unitPrice) || 0 : 0;
    }

    function estimateItemsFor(request) {
      return Array.isArray(request.estimateItems) ? request.estimateItems : [];
    }

    function estimateTable(items, interactive) {
      if (!items.length) return "<p class=\"center-empty-state\">No damaged parts have been added to this estimate.</p>";
      return "<div class=\"center-table-wrap\"><table class=\"center-table\"><thead><tr><th>Part</th><th>Part cost</th><th>Labor</th><th>Total</th>" + (interactive ? "<th></th>" : "") + "</tr></thead><tbody>" +
        items.map((item) => "<tr><td>" + escape(item.partName) + "</td><td>$" + Number(item.partCost || 0).toFixed(2) + "</td><td>$" + Number(item.laborCost || 0).toFixed(2) + "</td><td><strong>$" + (Number(item.partCost || 0) + Number(item.laborCost || 0)).toFixed(2) + "</strong></td>" +
          (interactive ? "<td><button type=\"button\" class=\"link-button\" data-remove-estimate=\"" + escape(item.id) + "\">Remove</button></td>" : "") + "</tr>").join("") +
        "</tbody></table></div>";
    }

    function requestActionMarkup(request) {
      if (request.status === "requested") {
        if (request.initiatedBy !== "center") {
          return "<div class=\"center-action-box\"><strong>Owner requested service</strong><p>" + (request.pickupDate ? escape(window.CarCareUI.formatDate(request.pickupDate) + " at " + formatTime(request.pickupTime)) : "Coordinate a pickup with the owner.") + "</p><button class=\"button button-primary\" type=\"button\" data-pickup=\"" + escape(request.id) + "\">Mark Car Picked Up</button></div>";
        }
        return "<div class=\"center-action-box\"><strong>Waiting for customer response</strong><p>The owner has not accepted this service request yet.</p></div>";
      }
      if (request.status === "accepted-by-owner" || request.status === "inspection-pending") {
        return "<div class=\"center-action-box\"><strong>Pickup is scheduled</strong><p>" + (request.pickupDate ? escape(window.CarCareUI.formatDate(request.pickupDate) + " at " + formatTime(request.pickupTime)) : "Confirm the pickup with the customer.") + "</p><button class=\"button button-primary\" type=\"button\" data-pickup=\"" + escape(request.id) + "\">Mark Car Picked Up</button></div>";
      }
      if (request.status === "car-picked-up") {
        return "<div class=\"center-action-box\"><strong>Vehicle picked up</strong><p>Inspect the vehicle and prepare an itemized estimate for the owner.</p><button class=\"button button-primary\" type=\"button\" data-start-estimate=\"" + escape(request.id) + "\">Create Cost Estimate</button></div>";
      }
      if (request.status === "estimate-ready" || request.status === "estimate-sent") {
        return "<div class=\"center-action-box\"><strong>Estimate sent to owner</strong><p>Waiting for the owner to confirm which items to service.</p>" + estimateTable(estimateItemsFor(request), false) + "</div>";
      }
      if (request.status === "parts-confirmed") {
        return "<div class=\"center-action-box\"><strong>Owner confirmed parts for service</strong><p>Only the selected parts will be completed and logged.</p>" + estimateTable(selectedEstimateItems(request), false) + "<button class=\"button button-primary\" type=\"button\" data-start-service=\"" + escape(request.id) + "\">Start Service</button></div>";
      }
      if (request.status === "in-service") {
        return completionForm(request);
      }
      if (["completed", "service-completed", "paid"].includes(request.status)) {
        return "<div class=\"center-action-box\"><strong>Service complete</strong><p>Service history has been recorded and the owner has been notified that payment is due.</p>" + (request.serviceHistoryId ? "<p>History record: " + escape(request.serviceHistoryId) + "</p>" : "") + "</div>";
      }
      return "<div class=\"center-action-box\"><strong>Request " + escape(statusLabel(request.status).toLowerCase()) + "</strong></div>";
    }

    function selectedEstimateItems(request) {
      const selected = new Set(request.selectedPartsForService || []);
      return estimateItemsFor(request).filter((item) => selected.has(item.id));
    }

    function completionForm(request) {
      const items = selectedEstimateItems(request);
      if (!items.length) return "<div class=\"center-action-box\"><strong>No confirmed parts are selected.</strong><p>Ask the owner to confirm estimate items before completing service.</p></div>";
      const today = todayString();
      return "<div class=\"center-action-box\"><strong>Record completed parts and expiry dates</strong><p>Suggested expiry dates can be adjusted to match the installed part.</p><form class=\"center-completion-form\" data-complete-form=\"" + escape(request.id) + "\" novalidate>" +
        items.map((item, index) => "<fieldset class=\"center-completion-part\" data-completion-part><legend>" + escape(item.partName) + " · $" + (Number(item.partCost || 0) + Number(item.laborCost || 0)).toFixed(2) + "</legend><input type=\"hidden\" name=\"itemId\" value=\"" + escape(item.id) + "\"><label>Install date<input type=\"date\" name=\"installDate\" value=\"" + today + "\" required></label><label>New expiry date<input type=\"date\" name=\"expiryDate\" value=\"" + suggestedExpiry(item.partName) + "\" required></label></fieldset>"
        ).join("") + "<div class=\"form-message\" data-complete-message role=\"status\"></div><button class=\"button button-primary\" type=\"submit\">Complete Service</button></form></div>";
    }

    function addMonths(date, months) {
      const result = new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
      if (result.getDate() !== date.getDate()) result.setDate(0);
      return localDate(result);
    }

    function suggestedExpiry(partName) {
      const lower = partName.toLowerCase();
      const months = lower.includes("oil") ? 6 : lower.includes("brake") ? 24 :
        lower.includes("battery") ? 36 : lower.includes("tire") ? 60 :
          lower.includes("filter") ? 12 : lower.includes("belt") ? 60 : 12;
      return addMonths(new Date(), months);
    }

    function renderRequestDetail(requestId) {
      const request = requestsForCenter().find((item) => item.id === requestId);
      const panel = document.getElementById("request-detail-panel");
      if (!request) {
        panel.classList.add("hidden");
        panel.innerHTML = "";
        return;
      }
      activeRequestId = requestId;
      const vehicle = vehicleFor(request.vehicleId);
      const owner = ownerFor(request.ownerId);
      const parts = getData("parts").filter((part) => part.vehicleId === request.vehicleId);
      const requestedParts = (request.requestedParts || []).map((id) => parts.find((part) => part.id === id)?.partName || id);
      const estimate = estimateItemsFor(request);
      const total = estimate.reduce((sum, item) => sum + Number(item.partCost || 0) + Number(item.laborCost || 0), 0);
      panel.classList.remove("hidden");
      panel.innerHTML = "<div class=\"center-detail-heading\"><div><p class=\"eyebrow\">REQUEST DETAILS</p><h2>" + escape(request.orderNumber || request.id) + "</h2><p>" + escape(vehicleLabel(vehicle)) + (vehicle ? " · " + escape(vehicle.vehicleNumber) : "") + "</p></div><div class=\"center-detail-tools\"><span class=\"table-status " + statusClass(request.status) + "\">" + escape(statusLabel(request.status)) + "</span><button class=\"button button-outline button-small\" type=\"button\" data-close-detail>Close</button></div></div>" +
        "<div class=\"center-customer-detail\"><div><small>CUSTOMER</small>" + customerMarkup(owner) + "</div><div><small>VEHICLE</small><strong>" + escape(vehicleLabel(vehicle)) + "</strong><span>" + escape(vehicle ? vehicle.vehicleNumber : "Not available") + "</span></div><div><small>PICKUP</small><strong>" + escape(request.pickupDate ? window.CarCareUI.formatDate(request.pickupDate) : "Not scheduled") + "</strong><span>" + escape(formatTime(request.pickupTime)) + "</span></div></div>" +
        (requestedParts.length ? "<p class=\"center-requested-parts\"><strong>Owner requested checks:</strong> " + escape(requestedParts.join(", ")) + "</p>" : "") +
        (request.reason ? "<p class=\"center-requested-parts\"><strong>Request note:</strong> " + escape(request.reason) + "</p>" : "") +
        "<div class=\"center-workflow-content\">" + requestActionMarkup(request) + "</div>" +
        ((request.status === "car-picked-up" || request.status === "estimate-ready" || request.status === "estimate-sent" || request.status === "parts-confirmed" || request.status === "in-service") ?
          "<div class=\"center-estimate-summary\"><span>Estimate total</span><strong>$" + total.toFixed(2) + "</strong></div>" : "");
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function renderDashboard() {
      document.getElementById("center-title").textContent = (session.name ? "Welcome back, " + session.name + "." : "Service Center Dashboard.");
      document.getElementById("center-role").textContent = session.role === "manager" ? "Manager" : session.role === "technician" ? "Technician" : "Service Center";
      const centerUser = centerUsers()[0];
      if (centerUser && centerUser.serviceCenterName) document.title = centerUser.serviceCenterName + " | Car Care";
      renderFollowups();
      renderRequests();
    }

    function openTab(tab) {
      document.querySelectorAll("[data-center-tab]").forEach((button) => button.classList.toggle("active", button.dataset.centerTab === tab));
      document.querySelectorAll("[data-center-view]").forEach((section) => {
        const isActive = section.dataset.centerView === tab;
        section.classList.toggle("hidden", !isActive);
      });
    }

    function createCenterRequest(vehicleId) {
      const vehicle = vehicleFor(vehicleId);
      if (!vehicle) {
        window.CarCareUI.toast("This vehicle is not available to your center.", "error");
        return;
      }
      if (requestsForCenter().some((request) => request.vehicleId === vehicle.id && !["completed", "service-completed", "paid", "declined", "cancelled"].includes(request.status))) {
        window.CarCareUI.toast("An open service request already exists for this vehicle.", "error");
        return;
      }
      const urgency = urgencyItems().find((item) => item.vehicle.id === vehicle.id);
      const requestedParts = urgency ? urgency.attention.map((item) => item.part.id) : [];
      const orderNumber = nextOrderNumber();
      const request = {
        id: "request-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        orderNumber,
        ownerId: vehicle.ownerId,
        vehicleId: vehicle.id,
        serviceCenterId: centerId,
        initiatedBy: "center",
        status: "requested",
        requestedParts,
        reason: "Parts are due or past their estimated expiry date.",
        createdAt: new Date().toISOString()
      };
      try {
        saveData("serviceRequests", getData("serviceRequests").concat(request));
        notifyOwner(request.ownerId, request, "service-request", (centerUsers()[0]?.serviceCenterName || "Your service center") + " sent you a service request for " + vehicleLabel(vehicle) + ".");
        renderDashboard();
        window.CarCareUI.toast("Service request " + orderNumber + " sent to " + (ownerFor(request.ownerId)?.name || "the owner") + ".", "success");
      } catch (error) {
        window.CarCareUI.toast("Service request could not be saved: " + error.message, "error");
      }
    }

    function nextOrderNumber() {
      const prefix = "CC-" + new Date().getFullYear() + "-";
      const numbers = getData("serviceRequests").map((request) => request.orderNumber)
        .filter((value) => typeof value === "string" && value.startsWith(prefix))
        .map((value) => Number(value.slice(prefix.length))).filter(Number.isFinite);
      return prefix + String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(5, "0");
    }

    function markPickedUp(requestId) {
      try {
        const request = writeRequest(requestId, { status: "car-picked-up", pickedUpAt: new Date().toISOString() });
        notifyOwner(request.ownerId, request, "pickup-update", "Your car has been picked up by the service center.");
        renderDashboard();
        renderRequestDetail(requestId);
        window.CarCareUI.toast("Vehicle marked as picked up.", "success");
      } catch (error) {
        window.CarCareUI.toast(error.message, "error");
      }
    }

    function renderEstimateEditor(requestId) {
      const request = requestsForCenter().find((item) => item.id === requestId);
      if (!request || request.status !== "car-picked-up") return;
      const vehicleParts = getData("parts").filter((part) => part.vehicleId === request.vehicleId);
      const existing = estimateItemsFor(request);
      const panel = document.getElementById("request-detail-panel");
      const options = vehicleParts.map((part) => "<option value=\"" + escape(part.id) + "\">" + escape(part.partName) + "</option>").join("");
      panel.innerHTML += "<form class=\"center-estimate-form\" data-estimate-form=\"" + escape(requestId) + "\"><div class=\"center-subheading\"><div><h3>Damaged parts and costs</h3><p>Part prices are suggested from this center’s inventory and can be adjusted.</p></div><button class=\"button button-outline button-small\" type=\"button\" data-add-estimate-line>Add damaged part</button></div><div class=\"center-estimate-lines\" data-estimate-lines></div><div class=\"center-estimate-total\">Running total <strong data-estimate-total>$0.00</strong></div><div class=\"form-message\" data-estimate-message role=\"status\"></div><div class=\"center-form-actions\"><button class=\"button button-primary\" type=\"submit\">Send Estimate to Owner</button><button class=\"button button-quiet\" type=\"button\" data-cancel-estimate>Cancel</button></div></form>";
      const form = panel.querySelector("[data-estimate-form]");
      const lines = form.querySelector("[data-estimate-lines]");

      function addLine(item) {
        const row = document.createElement("div");
        row.className = "center-estimate-line";
        row.innerHTML = "<label>Damaged part<select name=\"partId\" required><option value=\"\">Choose a vehicle part</option>" + options + "<option value=\"__other__\">Other / not listed</option></select><input class=\"hidden\" name=\"customPartName\" type=\"text\" placeholder=\"Enter part name\"></label><label>Part cost<input name=\"partCost\" type=\"number\" min=\"0\" step=\"0.01\" value=\"0\" required></label><label>Labor cost<input name=\"laborCost\" type=\"number\" min=\"0\" step=\"0.01\" value=\"0\" required></label><button class=\"link-button\" type=\"button\" data-delete-line aria-label=\"Remove estimate line\">Remove</button>";
        lines.appendChild(row);
        if (item) {
          row.querySelector("[name=partId]").value = item.partId || "";
          if (!item.partId) {
            row.querySelector("[name=partId]").value = "__other__";
            row.querySelector("[name=customPartName]").classList.remove("hidden");
            row.querySelector("[name=customPartName]").value = item.partName;
          }
          row.querySelector("[name=partCost]").value = Number(item.partCost || 0).toFixed(2);
          row.querySelector("[name=laborCost]").value = Number(item.laborCost || 0).toFixed(2);
        }
        return row;
      }

      function updateTotal() {
        const total = Array.from(lines.querySelectorAll(".center-estimate-line")).reduce((sum, row) =>
          sum + Number(row.querySelector("[name=partCost]").value || 0) + Number(row.querySelector("[name=laborCost]").value || 0), 0);
        form.querySelector("[data-estimate-total]").textContent = "$" + total.toFixed(2);
      }

      if (existing.length) existing.forEach(addLine);
      else addLine();
      lines.addEventListener("change", (event) => {
        if (event.target.name === "partId") {
          const other = event.target.value === "__other__";
          const customName = event.target.closest(".center-estimate-line").querySelector("[name=customPartName]");
          customName.classList.toggle("hidden", !other);
          customName.required = other;
          const part = vehicleParts.find((item) => item.id === event.target.value);
          const row = event.target.closest(".center-estimate-line");
          row.querySelector("[name=partCost]").value = (part ? inventoryPrice(part.partName) : 0).toFixed(2);
        } else if (event.target.name === "customPartName") {
          const row = event.target.closest(".center-estimate-line");
          row.querySelector("[name=partCost]").value = inventoryPrice(event.target.value).toFixed(2);
        }
        updateTotal();
      });
      lines.addEventListener("input", (event) => {
        if (event.target.name === "customPartName") {
          event.target.closest(".center-estimate-line").querySelector("[name=partCost]").value = inventoryPrice(event.target.value).toFixed(2);
        }
        updateTotal();
      });
      form.querySelector("[data-add-estimate-line]").addEventListener("click", () => addLine());
      lines.addEventListener("click", (event) => {
        if (event.target.matches("[data-delete-line]")) {
          event.target.closest(".center-estimate-line").remove();
          updateTotal();
        }
      });
      form.querySelector("[data-cancel-estimate]").addEventListener("click", () => renderRequestDetail(requestId));
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const rows = Array.from(lines.querySelectorAll(".center-estimate-line"));
        if (!rows.length) {
          form.querySelector("[data-estimate-message]").textContent = "Add at least one damaged part to the estimate.";
          return;
        }
        const items = [];
        for (const row of rows) {
          const partId = row.querySelector("[name=partId]").value;
          const part = vehicleParts.find((item) => item.id === partId);
          const partName = partId === "__other__" ? row.querySelector("[name=customPartName]").value.trim() : part && part.partName;
          const partCost = Number(row.querySelector("[name=partCost]").value);
          const laborCost = Number(row.querySelector("[name=laborCost]").value);
          if (!partName || (partId !== "__other__" && !part) || !Number.isFinite(partCost) || partCost < 0 || !Number.isFinite(laborCost) || laborCost < 0) {
            form.querySelector("[data-estimate-message]").textContent = "Choose or name each damaged part and enter valid non-negative costs.";
            return;
          }
          items.push({ id: "estimate-item-" + Date.now() + "-" + items.length, partId: part ? part.id : null, partName, partCost, laborCost });
        }
        const total = items.reduce((sum, item) => sum + item.partCost + item.laborCost, 0);
        try {
          const updated = writeRequest(requestId, { status: "estimate-ready", estimateItems: items, estimateTotal: Number(total.toFixed(2)), estimateSentAt: new Date().toISOString(), selectedPartsForService: [] });
          notifyOwner(updated.ownerId, updated, "estimate-ready", (centerUsers()[0]?.serviceCenterName || "Your service center") + " has sent a service estimate for " + (vehicleLabel(vehicleFor(updated.vehicleId)) + ". Review and confirm the parts you want serviced."));
          renderRequests();
          renderRequestDetail(requestId);
          window.CarCareUI.toast("Estimate sent to the owner for confirmation.", "success");
        } catch (error) {
          form.querySelector("[data-estimate-message]").textContent = "Estimate could not be saved: " + error.message;
        }
      });
      updateTotal();
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function renderVehicleInfo(vehicle) {
      if (!vehicle) return "";
      const owner = ownerFor(vehicle.ownerId);
      const parts = getData("parts").filter((part) => part.vehicleId === vehicle.id);
      const history = getData("serviceHistory").filter((entry) => entry.vehicleId === vehicle.id)
        .sort((left, right) => new Date(right.date) - new Date(left.date));
      return "<section class=\"center-panel center-vehicle-result\"><div class=\"center-panel-heading\"><div><p class=\"eyebrow\">CUSTOMER VEHICLE</p><h2>" + escape(vehicleLabel(vehicle)) + "</h2><p>" + escape(vehicle.vehicleNumber) + "</p></div></div>" +
        "<div class=\"center-customer-detail\"><div><small>CUSTOMER</small>" + customerMarkup(owner) + "</div><div><small>VEHICLE</small><strong>" + escape(vehicleLabel(vehicle)) + "</strong><span>" + escape(vehicle.vehicleNumber) + "</span></div></div>" +
        "<form class=\"center-parts-form\" data-parts-form=\"" + escape(vehicle.id) + "\"><div class=\"center-subheading\"><div><h3>Parts and expiry dates</h3><p>Update installed and expiry dates, or add a part record.</p></div><button type=\"button\" class=\"button button-outline button-small\" data-add-vehicle-part>Add part</button></div><div class=\"center-part-edit-list\">" +
        parts.map((part) => partEditRow(part)).join("") +
        "</div><div class=\"form-message\" data-parts-message role=\"status\"></div><button class=\"button button-primary button-small\" type=\"submit\">Save part records</button></form>" +
        "<div class=\"center-history\"><h3>Service History</h3>" + (history.length ? history.map((entry) =>
          "<article class=\"center-history-row\"><div><strong>" + escape(window.CarCareUI.formatDate(entry.date)) + " · " + escape(entry.serviceCenterName || "Service center") + "</strong><small>" + escape((entry.partsChanged || []).join(", ")) + " · Technician: " + escape(entry.technician || "Not recorded") + "</small></div><strong>$" + Number(entry.cost || 0).toFixed(2) + "</strong></article>"
        ).join("") : "<p class=\"center-empty-state\">No service history recorded for this vehicle.</p>") + "</div></section>";
    }

    function partEditRow(part) {
      return "<div class=\"center-part-edit-row\" data-part-row>" +
        "<input type=\"hidden\" name=\"partId\" value=\"" + escape(part ? part.id : "") + "\">" +
        "<label>Part name<input name=\"partName\" value=\"" + escape(part ? part.partName : "") + "\" required></label>" +
        "<label>Install date<input name=\"installDate\" type=\"date\" value=\"" + escape(part ? part.installDate || "" : todayString()) + "\" required></label>" +
        "<label>Expiry date<input name=\"expiryDate\" type=\"date\" value=\"" + escape(part ? part.expiryDate || "" : "") + "\" required></label>" +
        (part ? "<span class=\"table-status " + partState(part).className + "\">" + escape(partState(part).status) + "</span>" : "<span class=\"center-inline-note\">New record</span>") +
        "</div>";
    }

    function searchVehicles(query) {
      const value = query.trim().toLowerCase();
      const results = centerVehicles().filter((vehicle) => vehicle.vehicleNumber.toLowerCase().includes(value));
      const target = document.getElementById("vehicle-search-results");
      target.innerHTML = results.length
        ? results.map(renderVehicleInfo).join("")
        : "<div class=\"center-panel\"><div class=\"center-empty-state\">No customer vehicles found for that vehicle number.</div></div>";
    }

    function completeService(form) {
      const requestId = form.dataset.completeForm;
      const request = requestsForCenter().find((item) => item.id === requestId);
      if (!request || request.status !== "in-service") throw new Error("This request is not ready to complete.");
      const selectedItems = selectedEstimateItems(request);
      const items = Array.from(form.querySelectorAll("[data-completion-part]"));
      if (items.length !== selectedItems.length || !items.length) throw new Error("Part completion details are missing.");
      const partCollection = getData("parts");
      const changedNames = [];
      items.forEach((fieldset) => {
        const item = selectedItems.find((entry) => entry.id === fieldset.querySelector("[name=itemId]").value);
        if (!item) throw new Error("An estimate item could not be matched to its completion details.");
        const installDate = fieldset.querySelector("[name=installDate]").value;
        const expiryDate = fieldset.querySelector("[name=expiryDate]").value;
        if (!installDate || !expiryDate || expiryDate < installDate) throw new Error("Each expiry date must be on or after its install date.");
        const part = partCollection.find((entry) => entry.id === item.partId && entry.vehicleId === request.vehicleId);
        if (part) {
          part.installDate = installDate;
          part.expiryDate = expiryDate;
        } else {
          partCollection.push({ id: "part-" + Date.now() + "-" + changedNames.length, vehicleId: request.vehicleId, partName: item.partName, installDate, expiryDate });
        }
        changedNames.push(item.partName);
      });
      const total = selectedItems.reduce((sum, item) => sum + Number(item.partCost || 0) + Number(item.laborCost || 0), 0);
      const vehicle = vehicleFor(request.vehicleId);
      if (!vehicle) throw new Error("The vehicle record could not be found.");
      const historyId = "service-" + Date.now();
      const centerUser = centerUsers().find((user) => user.id === session.id);
      const serviceHistory = getData("serviceHistory");
      const historyRecord = {
        id: historyId,
        ownerId: request.ownerId,
        vehicleId: request.vehicleId,
        serviceCenterId: centerId,
        serviceCenterName: centerUser?.serviceCenterName || window.CarCareData.getServiceCenterName(centerId) || "Service center",
        technician: session.name,
        date: todayString(),
        partsChanged: changedNames,
        cost: Number(total.toFixed(2)),
        serviceCompleted: true,
        paymentStatus: "Due",
        serviceRequestId: request.id
      };
      saveData("parts", partCollection);
      saveData("serviceHistory", serviceHistory.concat(historyRecord));
      const updated = writeRequest(requestId, { status: "completed", serviceHistoryId: historyId, serviceCompletedAt: new Date().toISOString(), serviceCost: historyRecord.cost, paymentStatus: "due" });
      notifyOwner(updated.ownerId, updated, "service-completed", "Your service is complete. Payment of $" + historyRecord.cost.toFixed(2) + " is due.");
      renderDashboard();
      renderRequestDetail(requestId);
      window.CarCareUI.toast("Service completed, part records updated, and service history saved.", "success");
    }

    document.querySelectorAll("[data-center-tab]").forEach((button) => button.addEventListener("click", () => openTab(button.dataset.centerTab)));
    document.querySelectorAll("[data-open-tab]").forEach((button) => button.addEventListener("click", () => openTab(button.dataset.openTab)));
    document.getElementById("center-followups").addEventListener("click", (event) => {
      const button = event.target.closest("[data-send-request]");
      if (button) createCenterRequest(button.dataset.sendRequest);
    });
    document.addEventListener("click", (event) => {
      const open = event.target.closest("[data-open-request]");
      if (open) {
        openTab("requests");
        renderRequestDetail(open.dataset.openRequest);
        return;
      }
      const close = event.target.closest("[data-close-detail]");
      if (close) {
        activeRequestId = null;
        document.getElementById("request-detail-panel").classList.add("hidden");
        return;
      }
      const pickup = event.target.closest("[data-pickup]");
      if (pickup) {
        markPickedUp(pickup.dataset.pickup);
        return;
      }
      const estimate = event.target.closest("[data-start-estimate]");
      if (estimate) {
        renderEstimateEditor(estimate.dataset.startEstimate);
        return;
      }
      const startService = event.target.closest("[data-start-service]");
      if (startService) {
        try {
          const updated = writeRequest(startService.dataset.startService, { status: "in-service", serviceStartedAt: new Date().toISOString() });
          notifyOwner(updated.ownerId, updated, "service-started", "The service center has started work on the parts you confirmed.");
          renderRequests();
          renderRequestDetail(updated.id);
          window.CarCareUI.toast("Service started.", "success");
        } catch (error) {
          window.CarCareUI.toast(error.message, "error");
        }
      }
    });
    document.addEventListener("submit", (event) => {
      const completionFormElement = event.target.closest("[data-complete-form]");
      if (completionFormElement) {
        event.preventDefault();
        const message = completionFormElement.querySelector("[data-complete-message]");
        try {
          completeService(completionFormElement);
        } catch (error) {
          message.textContent = error.message;
        }
        return;
      }
      const partForm = event.target.closest("[data-parts-form]");
      if (partForm) {
        event.preventDefault();
        try {
          const vehicleId = partForm.dataset.partsForm;
          const current = getData("parts");
          const rows = Array.from(partForm.querySelectorAll("[data-part-row]"));
          const updatedParts = current.filter((part) => part.vehicleId !== vehicleId);
          for (const row of rows) {
            const partName = row.querySelector("[name=partName]").value.trim();
            const installDate = row.querySelector("[name=installDate]").value;
            const expiryDate = row.querySelector("[name=expiryDate]").value;
            if (!partName || !installDate || !expiryDate || expiryDate < installDate) throw new Error("Enter a part name and valid dates; expiry must be on or after install date.");
            updatedParts.push({ id: row.querySelector("[name=partId]").value || "part-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6), vehicleId, partName, installDate, expiryDate });
          }
          saveData("parts", updatedParts);
          window.CarCareUI.toast("Vehicle part records updated.", "success");
          searchVehicles(document.getElementById("vehicle-search-input").value);
          renderDashboard();
        } catch (error) {
          partForm.querySelector("[data-parts-message]").textContent = error.message;
        }
        return;
      }
      const searchForm = event.target.closest("#vehicle-search-form");
      if (searchForm) {
        event.preventDefault();
        searchVehicles(searchForm.elements.vehicleNumber.value);
        return;
      }
      const estimateForm = event.target.closest("[data-estimate-form]");
      if (estimateForm) {
        event.preventDefault();
        return;
      }
    });
    document.addEventListener("click", (event) => {
      const addPart = event.target.closest("[data-add-vehicle-part]");
      if (addPart) {
        const rows = addPart.closest("[data-parts-form]").querySelector(".center-part-edit-list");
        rows.insertAdjacentHTML("beforeend", partEditRow(null));
      }
      const removeEstimate = event.target.closest("[data-remove-estimate]");
      if (removeEstimate && activeRequestId) {
        const request = requestsForCenter().find((item) => item.id === activeRequestId);
        if (!request) return;
        try {
          const updatedItems = estimateItemsFor(request).filter((item) => item.id !== removeEstimate.dataset.removeEstimate);
          writeRequest(request.id, { estimateItems: updatedItems, estimateTotal: updatedItems.reduce((sum, item) => sum + Number(item.partCost || 0) + Number(item.laborCost || 0), 0) });
          renderRequestDetail(request.id);
        } catch (error) {
          window.CarCareUI.toast(error.message, "error");
        }
      }
    });

    document.getElementById("center-title").textContent = session.name ? "Welcome back, " + session.name + "." : "Service Center Dashboard.";
    document.getElementById("center-role").textContent = session.role === "manager" ? "Manager" : session.role === "technician" ? "Technician" : "Service Center";
    const firstUser = centerUsers()[0];
    if (firstUser && firstUser.serviceCenterName) document.getElementById("center-title").textContent = firstUser.serviceCenterName;
    renderDashboard();
  });
}());
