(function () {
  "use strict";

  const DAY_MS = 24 * 60 * 60 * 1000;
  let session;
  let ownedVehicles = [];
  let selectedVehicleId = null;
  let vehicleCatalog = [];

  function escape(value) {
    return window.CarCareUI.escapeHtml(value == null ? "" : value);
  }

  function todayAtMidnight() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  function daysUntil(dateValue) {
    const target = new Date(dateValue + "T00:00:00");
    if (Number.isNaN(target.getTime())) return null;
    return Math.ceil((target.getTime() - todayAtMidnight().getTime()) / DAY_MS);
  }

  function partStatus(part) {
    const remaining = daysUntil(part.expiryDate);
    if (remaining === null) return { label: "Unknown", className: "neutral", remaining: null };
    if (remaining < 0) return { label: "Expired", className: "expired", remaining };
    if (remaining <= 30) return { label: "Due Soon", className: "due", remaining };
    return { label: "OK", className: "ok", remaining };
  }

  function getOwnerParts() {
    const vehicleIds = new Set(ownedVehicles.map((vehicle) => vehicle.id));
    return window.CarCareData.get("parts").filter((part) => vehicleIds.has(part.vehicleId));
  }

  function ownerNotifications() {
    return window.CarCareData.get("notifications")
      .filter((notification) => notification.recipientId === session.id)
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  }

  function notifyForOwnerActivity() {
    const notifications = window.CarCareData.get("notifications");
    const existingKeys = new Set(notifications.map((notification) => notification.notificationKey).filter(Boolean));
    const newNotifications = [];
    const addNotification = (key, type, message, relatedId) => {
      if (existingKeys.has(key) || notifications.some((notification) =>
        notification.recipientId === session.id && notification.relatedId === relatedId && notification.type === type
      )) return;
      existingKeys.add(key);
      newNotifications.push({
        id: "notification-" + key,
        notificationKey: key,
        recipientId: session.id,
        type,
        message,
        relatedId: relatedId || null,
        createdAt: new Date().toISOString(),
        read: false,
        simulated: true
      });
    };

    getOwnerParts().forEach((part) => {
      const status = partStatus(part);
      if (status.remaining === null || status.remaining > 30) return;
      const vehicle = ownedVehicles.find((item) => item.id === part.vehicleId);
      const key = "expiry-" + session.id + "-" + part.id + "-" + part.expiryDate;
      const expiryCopy = status.remaining < 0
        ? "expired " + Math.abs(status.remaining) + " days ago."
        : status.remaining === 0
          ? "expires today."
          : "expires in " + status.remaining + " days.";
      addNotification(
        key,
        "expiry-reminder",
        (vehicle ? vehicle.vehicleMake + " " + vehicle.carModel + ": " : "") + part.partName + " " + expiryCopy,
        part.id
      );
    });

    window.CarCareData.get("serviceRequests")
      .filter((request) => request.ownerId === session.id)
      .forEach((request) => {
        const centerName = window.CarCareData.getServiceCenterName(request.serviceCenterId) || "Your service center";
        const key = "request-" + request.id + "-" + request.status;
        let type = "service-request";
        let message = request.initiatedBy === "center"
          ? centerName + " sent you a service request."
          : "Your service request " + (request.orderNumber || "") + " is " + serviceRequestStatusLabel(request.status).toLowerCase() + ".";
        if (request.status === "estimate-ready") {
          type = "estimate-ready";
          message = centerName + " has prepared a service estimate for your vehicle.";
        } else if (request.status === "service-completed" || request.status === "completed") {
          type = "service-completed";
          message = centerName + " marked your service as complete.";
        } else if (request.status === "declined") {
          message = "You declined a service request from " + centerName + ".";
        } else if (request.status === "cancelled") {
          message = "Your service request " + (request.orderNumber || "") + " was cancelled.";
        }
        addNotification(key, type, message, request.id);
      });

    const historyIds = new Set(window.CarCareData.get("serviceHistory")
      .filter((item) => item.ownerId === session.id)
      .map((item) => item.id));
    window.CarCareData.get("payments")
      .filter((payment) => payment.paymentSuccessful &&
        (historyIds.has(payment.serviceHistoryId) || payment.ownerId === session.id))
      .forEach((payment) => {
        addNotification(
          "payment-" + payment.id,
          "payment-receipt",
          "Payment receipt: " + Number(payment.amount).toFixed(2) + " via " + (payment.method || "online payment") + ".",
          payment.id
        );
      });

    if (newNotifications.length) {
      window.CarCareData.save("notifications", notifications.concat(newNotifications));
    }
  }

  function setUnreadCount(count) {
    ["header-unread-count", "nav-unread-count", "owner-unread-total"].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.textContent = String(count);
    });
    document.querySelectorAll(".notification-count").forEach((badge) => {
      badge.classList.toggle("hidden", count === 0);
    });
  }

  function renderNotifications(target, limit) {
    const notifications = ownerNotifications();
    const visible = typeof limit === "number" ? notifications.slice(0, limit) : notifications;
    if (!visible.length) {
      target.innerHTML = "<div class=\"owner-empty-state\">You’re all caught up. New vehicle and service updates will appear here.</div>";
      return;
    }
    target.innerHTML = visible.map((notification) => {
      const typeLabels = {
        "expiry-reminder": "Part expiry reminder",
        "service-reminder": "Service reminder",
        "service-request": "Service request",
        "estimate-ready": "Estimate ready",
        "service-completed": "Service completed",
        "payment-receipt": "Payment receipt"
      };
      return "<article class=\"owner-notification " + (notification.read ? "" : "unread") + "\">" +
        "<span class=\"owner-notification-icon\" aria-hidden=\"true\">" + notificationIcon(notification.type) + "</span>" +
        "<div class=\"owner-notification-copy\"><strong>" + escape(typeLabels[notification.type] || "Vehicle update") + "</strong>" +
        "<p>" + escape(notification.message) + "</p><small>" + window.CarCareUI.formatDate(notification.createdAt.slice(0, 10)) +
        (notification.simulated || ["expiry-reminder", "service-reminder"].includes(notification.type) ? " · In-app · Email/SMS simulated" : "") + "</small></div>" +
        (notification.read ? "<span class=\"read-label\">Read</span>" : "<button class=\"notification-read-button\" type=\"button\" data-mark-read=\"" + escape(notification.id) + "\">Mark as read</button>") +
        "</article>";
    }).join("");
  }

  function notificationIcon(type) {
    if (type === "payment-receipt") return "$";
    if (type === "service-completed") return "✓";
    if (type === "estimate-ready") return "≋";
    if (type === "service-request") return "↗";
    return "!";
  }

  function renderVehicleCard(vehicle, target) {
    const vehicleParts = window.CarCareData.get("parts").filter((part) => part.vehicleId === vehicle.id);
    const attentionCount = vehicleParts.filter((part) => partStatus(part).remaining !== null && partStatus(part).remaining <= 30).length;
    const pending = vehicle.approvalStatus === "pending";
    return "<button class=\"owner-vehicle-card\" type=\"button\" data-open-vehicle=\"" + escape(vehicle.id) + "\">" +
      "<span class=\"vehicle-card-icon\" aria-hidden=\"true\">▣</span><span class=\"vehicle-card-content\"><strong>" +
      escape(vehicle.year + " " + vehicle.vehicleMake + " " + vehicle.carModel) + "</strong><small>" + escape(vehicle.vehicleNumber) +
      "</small><span class=\"vehicle-card-status\">" + (pending
        ? "<span class=\"table-status due\">Pending admin review</span>"
        : "<span class=\"table-status ok\">" + attentionCount + " item" + (attentionCount === 1 ? "" : "s") + " need attention</span>") +
      "</span></span><span class=\"vehicle-card-arrow\" aria-hidden=\"true\">→</span></button>";
  }

  function renderVehicles() {
    const dashboardVehicles = document.getElementById("dashboard-vehicles");
    const vehiclesList = document.getElementById("owner-vehicles-list");
    if (!ownedVehicles.length) {
      const empty = "<div class=\"owner-empty-state\">No vehicles have been added yet. Add your first vehicle to start tracking parts and expiry dates.</div>";
      dashboardVehicles.innerHTML = empty;
      vehiclesList.innerHTML = empty;
      return;
    }
    dashboardVehicles.innerHTML = ownedVehicles.slice(0, 3).map((vehicle) => renderVehicleCard(vehicle)).join("");
    vehiclesList.innerHTML = ownedVehicles.map((vehicle) => renderVehicleCard(vehicle)).join("");
  }

  function renderVehicleDetails(vehicleId) {
    const vehicle = ownedVehicles.find((item) => item.id === vehicleId);
    if (!vehicle) return;
    selectedVehicleId = vehicleId;
    document.getElementById("vehicle-details-panel").classList.remove("hidden");
    document.getElementById("selected-vehicle-title").textContent = vehicle.year + " " + vehicle.vehicleMake + " " + vehicle.carModel;
    document.getElementById("selected-vehicle-meta").textContent = vehicle.vehicleNumber;
    const pending = vehicle.approvalStatus === "pending";
    document.getElementById("pending-review-notice").classList.toggle("hidden", !pending);
    document.getElementById("request-selected-vehicle-service").classList.toggle("hidden", pending);
    const vehicleParts = window.CarCareData.get("parts").filter((part) => part.vehicleId === vehicle.id);
    const tbody = document.getElementById("selected-vehicle-parts");
    tbody.innerHTML = vehicleParts.map((part) => {
      const status = partStatus(part);
      const dayLabel = status.remaining === null ? "—" : status.remaining < 0
        ? Math.abs(status.remaining) + " days overdue"
        : status.remaining + " days";
      return "<tr><td><strong>" + escape(part.partName) + "</strong></td><td>" + window.CarCareUI.formatDate(part.installDate) +
        "</td><td>" + window.CarCareUI.formatDate(part.expiryDate) + "</td><td>" + dayLabel +
        "</td><td><span class=\"table-status " + status.className + "\">" + status.label + "</span></td></tr>";
    }).join("");
    document.getElementById("no-parts-message").classList.toggle("hidden", vehicleParts.length > 0);
    document.getElementById("vehicle-parts-content").classList.toggle("hidden", pending);
  }

  function renderHistory() {
    const history = window.CarCareData.get("serviceHistory")
      .filter((item) => item.ownerId === session.id || ownedVehicles.some((vehicle) => vehicle.id === item.vehicleId))
      .sort((left, right) => new Date(right.date) - new Date(left.date));
    const payments = window.CarCareData.get("payments");
    const target = document.getElementById("owner-service-history");
    if (!history.length) {
      target.innerHTML = "<div class=\"owner-empty-state\">No completed services have been recorded for your vehicles yet.</div>";
      return;
    }
    target.innerHTML = history.map((item) => {
      const payment = payments.find((entry) => entry.serviceHistoryId === item.id);
      const vehicle = ownedVehicles.find((entry) => entry.id === item.vehicleId);
      const paymentLabel = payment ? (payment.paymentSuccessful ? "Paid" : "Payment pending") : "No payment record";
      const paymentClass = payment && payment.paymentSuccessful ? "ok" : "due";
      return "<article class=\"owner-history-entry\"><div class=\"history-date\">" + window.CarCareUI.formatDate(item.date) + "</div>" +
        "<div class=\"owner-history-main\"><strong>" + escape(item.serviceCenterName || "Service center") + "</strong>" +
        "<small>" + (vehicle ? escape(vehicle.year + " " + vehicle.vehicleMake + " " + vehicle.carModel) + " · " : "") +
        escape((item.partsChanged || []).join(", ")) + (item.technician ? " · Technician: " + escape(item.technician) : "") + "</small></div>" +
        "<span class=\"history-cost\">$" + Number(item.cost || 0).toFixed(2) + "</span>" +
        "<span class=\"table-status " + paymentClass + "\">" + paymentLabel + "</span></article>";
    }).join("");
  }

  function renderProfile() {
    document.getElementById("profile-name").textContent = session.ownerName || session.name;
    document.getElementById("profile-email").textContent = session.email;
    document.getElementById("profile-phone").textContent = session.phone || "Not provided";
    document.getElementById("profile-address").textContent = session.address || "Not provided";
    document.getElementById("profile-ssn").textContent = window.CarCareUI.maskSsn(session.ssn);
  }

  function setActiveView(viewName) {
    document.querySelectorAll("[data-owner-view]").forEach((view) => {
      const active = view.dataset.ownerView === viewName;
      view.hidden = !active;
      view.classList.toggle("active", active);
    });
    document.querySelectorAll(".owner-nav-link").forEach((button) => {
      button.classList.toggle("active", button.dataset.ownerTab === viewName);
    });
    if (viewName === "notifications") renderNotifications(document.getElementById("all-notifications"));
    if (viewName === "requests") renderServiceRequests();
    if (viewName === "history") renderHistory();
    if (viewName === "profile") renderProfile();
    window.scrollTo(0, 0);
  }

  function refreshNotificationViews() {
    const notifications = ownerNotifications();
    const unreadCount = notifications.filter((notification) => !notification.read).length;
    setUnreadCount(unreadCount);
    document.getElementById("owner-request-count").textContent = String(activeOwnerRequests().length);
    renderNotifications(document.getElementById("dashboard-notifications"), 4);
    if (!document.getElementById("owner-notifications").hidden) {
      renderNotifications(document.getElementById("all-notifications"));
    }
  }

  function populateCatalogSelects() {
    const makeSelect = document.getElementById("catalog-make");
    const makes = Array.from(new Set(vehicleCatalog.map((entry) => entry.make))).sort();
    makeSelect.innerHTML = "<option value=\"\">Choose a make</option>" + makes.map((make) =>
      "<option value=\"" + escape(make) + "\">" + escape(make) + "</option>"
    ).join("");
    updateModels();
  }

  function updateModels() {
    const make = document.getElementById("catalog-make").value;
    const models = Array.from(new Set(vehicleCatalog.filter((entry) => entry.make === make).map((entry) => entry.model))).sort();
    const modelSelect = document.getElementById("catalog-model");
    modelSelect.innerHTML = "<option value=\"\">Choose a model</option>" + models.map((model) =>
      "<option value=\"" + escape(model) + "\">" + escape(model) + "</option>"
    ).join("");
    updateYears();
  }

  function updateYears() {
    const make = document.getElementById("catalog-make").value;
    const model = document.getElementById("catalog-model").value;
    const years = Array.from(new Set(vehicleCatalog.filter((entry) => entry.make === make && entry.model === model).map((entry) => String(entry.year)))).sort().reverse();
    document.getElementById("catalog-year").innerHTML = "<option value=\"\">Choose a year</option>" + years.map((year) =>
      "<option value=\"" + escape(year) + "\">" + escape(year) + "</option>"
    ).join("");
  }

  function getServiceCenters(vehicle) {
    const users = window.CarCareData.get("users");
    const centerMap = new Map();
    users.filter((user) => ["center", "manager", "technician"].includes(user.role) && user.serviceCenterId)
      .forEach((user) => {
        if (!centerMap.has(user.serviceCenterId)) {
          centerMap.set(user.serviceCenterId, {
            id: user.serviceCenterId,
            name: user.serviceCenterName || user.name,
            address: user.serviceCenterAddress || ""
          });
        }
      });
    const centers = Array.from(centerMap.values());
    const pastService = window.CarCareData.get("serviceHistory")
      .filter((item) => item.vehicleId === vehicle.id && item.serviceCenterId)
      .sort((left, right) => new Date(right.date) - new Date(left.date))[0];
    const recommendedId = pastService ? pastService.serviceCenterId : vehicle.assignedCenterId;
    centers.sort((left, right) => {
      if (left.id === recommendedId) return -1;
      if (right.id === recommendedId) return 1;
      return left.name.localeCompare(right.name);
    });
    return centers.map((center, index) => ({
      ...center,
      reason: center.id === recommendedId
        ? pastService && pastService.serviceCenterId === center.id
          ? "Recommended: this center serviced this vehicle before."
          : "Recommended for your registered vehicle."
        : index === 0
          ? "Recommended service center."
          : "Alternative service center."
    }));
  }

  function updateRequestVehicleChoices(preferredVehicleId) {
    const approvedVehicles = ownedVehicles.filter((vehicle) => vehicle.approvalStatus !== "pending" && vehicle.approvalStatus !== "rejected");
    const pendingVehicles = ownedVehicles.filter((vehicle) => vehicle.approvalStatus === "pending");
    const options = ["<option value=\"\">Choose a vehicle</option>"]
      .concat(approvedVehicles.map((vehicle) =>
        "<option value=\"" + escape(vehicle.id) + "\">" + escape(vehicle.year + " " + vehicle.vehicleMake + " " + vehicle.carModel + " · " + vehicle.vehicleNumber) + "</option>"
      ))
      .concat(pendingVehicles.map((vehicle) =>
        "<option value=\"\" disabled>" + escape(vehicle.year + " " + vehicle.vehicleMake + " " + vehicle.carModel + " · Pending admin review") + "</option>"
      ));
    const selector = document.getElementById("request-vehicle");
    selector.innerHTML = options.join("");
    if (preferredVehicleId && approvedVehicles.some((vehicle) => vehicle.id === preferredVehicleId)) {
      selector.value = preferredVehicleId;
    }
    renderRequestOptionsForVehicle(selector.value);
  }

  function renderRequestOptionsForVehicle(vehicleId) {
    const partsTarget = document.getElementById("request-parts-options");
    const centersTarget = document.getElementById("request-centers-options");
    const pendingWarning = document.getElementById("request-pending-warning");
    const vehicle = ownedVehicles.find((item) => item.id === vehicleId);
    const pendingVehicleSelected = vehicle && vehicle.approvalStatus === "pending";
    pendingWarning.classList.toggle("hidden", !pendingVehicleSelected);

    if (!vehicle || pendingVehicleSelected) {
      partsTarget.innerHTML = "<p class=\"owner-empty-state\">" + (pendingVehicleSelected
        ? "This model is pending admin review, so it cannot be scheduled yet."
        : "Choose an approved vehicle to see its parts.") + "</p>";
      centersTarget.innerHTML = "<p class=\"owner-empty-state\">Service center options will appear after you choose an approved vehicle.</p>";
      return;
    }

    const parts = window.CarCareData.get("parts").filter((part) => part.vehicleId === vehicle.id);
    partsTarget.innerHTML = parts.length ? parts.map((part) => {
      const status = partStatus(part);
      const checked = status.remaining !== null && status.remaining <= 30 ? " checked" : "";
      return "<label class=\"request-part-option\"><input type=\"checkbox\" name=\"requestPart\" value=\"" + escape(part.id) + "\"" + checked + "><span><strong>" + escape(part.partName) + "</strong><small>" + status.label + " · expires " + window.CarCareUI.formatDate(part.expiryDate) + "</small></span></label>";
    }).join("") : "<p class=\"owner-empty-state\">No part records found. Describe the issue in the notes field.</p>";

    const centers = getServiceCenters(vehicle);
    centersTarget.innerHTML = centers.length ? centers.map((center, index) =>
      "<label class=\"request-center-option " + (index === 0 ? "recommended" : "") + "\"><input type=\"radio\" name=\"serviceCenterId\" value=\"" + escape(center.id) + "\"" + (index === 0 ? " checked" : "") + "><span><strong>" + escape(center.name) + (index === 0 ? " <em>Recommended</em>" : "") + "</strong><small>" + escape(center.reason) + (center.address ? " · " + escape(center.address) : "") + "</small></span></label>"
    ).join("") : "<p class=\"owner-empty-state\">No service centers are available. Please try again later.</p>";
  }

  function requestOrderNumber() {
    const year = new Date().getFullYear();
    const prefix = "CC-" + year + "-";
    const usedNumbers = window.CarCareData.get("serviceRequests")
      .map((request) => request.orderNumber)
      .filter((number) => typeof number === "string" && number.startsWith(prefix))
      .map((number) => Number(number.slice(prefix.length)))
      .filter(Number.isFinite);
    const nextNumber = (usedNumbers.length ? Math.max(...usedNumbers) : 0) + 1;
    return prefix + String(nextNumber).padStart(5, "0");
  }

  function validPickupDateTime(date, time) {
    if (!date) return "Choose a preferred pickup date.";
    if (!time) return "Choose a preferred pickup time.";
    const today = new Date();
    const todayString = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
    if (date < todayString) return "Pickup date must be today or a future date.";
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
    if (!match) return "Enter a valid pickup time.";
    const minutes = Number(match[1]) * 60 + Number(match[2]);
    if (minutes < 8 * 60 || minutes > 17 * 60) return "Pickup times must be between 8:00 AM and 5:00 PM.";
    if (date === todayString) {
      const nowMinutes = today.getHours() * 60 + today.getMinutes();
      if (minutes < nowMinutes) return "Choose a pickup time later than the current time.";
    }
    return "";
  }

  function serviceRequestStatusLabel(status) {
    const labels = {
      requested: "Requested",
      "accepted-by-owner": "Accepted by Owner",
      "car-picked-up": "Car Picked Up",
      "inspection-pending": "Car Picked Up",
      "estimate-sent": "Inspected / Estimate Sent",
      "estimate-ready": "Inspected / Estimate Sent",
      "parts-confirmed": "Parts Confirmed",
      "in-service": "In Service",
      completed: "Completed",
      "service-completed": "Completed",
      paid: "Paid",
      declined: "Declined",
      cancelled: "Cancelled"
    };
    return labels[status] || "Requested";
  }

  const requestSteps = [
    ["requested", "Requested"],
    ["accepted-by-owner", "Accepted by Owner"],
    ["car-picked-up", "Car Picked Up"],
    ["estimate-sent", "Inspected / Estimate Sent"],
    ["parts-confirmed", "Parts Confirmed"],
    ["in-service", "In Service"],
    ["completed", "Completed"],
    ["paid", "Paid"]
  ];

  function requestProgressMarkup(request) {
    if (["declined", "cancelled"].includes(request.status)) {
      return "<div class=\"request-terminal-status " + escape(request.status) + "\">" + serviceRequestStatusLabel(request.status) + "</div>";
    }
    const aliases = { "inspection-pending": "car-picked-up", "estimate-ready": "estimate-sent", "service-completed": "completed" };
    const status = aliases[request.status] || request.status;
    let currentIndex = requestSteps.findIndex((step) => step[0] === status);
    if (currentIndex < 0) currentIndex = 0;
    return "<ol class=\"request-progress\">" + requestSteps.map((step, index) =>
      "<li class=\"" + (index < currentIndex ? "complete" : index === currentIndex ? "current" : "") + "\"><span>" +
      (index < currentIndex ? "✓" : String(index + 1)) + "</span><small>" + step[1] + "</small></li>"
    ).join("") + "</ol>";
  }

  function renderServiceRequests() {
    const requests = window.CarCareData.get("serviceRequests")
      .filter((request) => request.ownerId === session.id)
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    const target = document.getElementById("owner-request-list");
    if (!requests.length) {
      target.innerHTML = "<section class=\"owner-panel\"><div class=\"owner-empty-state\">No service requests yet. Request a pickup when a vehicle needs attention.</div></section>";
      return;
    }
    const centers = getServiceCenters(ownedVehicles[0] || { id: "" });
    const html = requests.map((request) => {
      const vehicle = ownedVehicles.find((item) => item.id === request.vehicleId);
      const center = centers.find((item) => item.id === request.serviceCenterId);
      const centerName = center ? center.name : window.CarCareData.getServiceCenterName(request.serviceCenterId) || "Service center";
      const requestedParts = (request.requestedParts || []).map((partId) => {
        const part = window.CarCareData.get("parts").find((entry) => entry.id === partId);
        return part ? part.partName : partId;
      });
      const isIncoming = request.initiatedBy === "center" && request.status === "requested";
      const canCancel = request.initiatedBy !== "center" && ["requested", "accepted-by-owner"].includes(request.status);
      const estimateItems = Array.isArray(request.estimateItems) ? request.estimateItems : [];
      const canConfirmEstimate = ["estimate-ready", "estimate-sent"].includes(request.status) && estimateItems.length > 0;
      const estimateMarkup = canConfirmEstimate
        ? "<form class=\"owner-estimate-confirmation\" data-estimate-confirm=\"" + escape(request.id) + "\"><h3>Service estimate</h3><p>Select the parts you approve for service. The total updates with your selection.</p><div class=\"owner-estimate-options\">" +
          estimateItems.map((item) => "<label class=\"owner-estimate-option\"><input type=\"checkbox\" name=\"approvedEstimateItem\" value=\"" + escape(item.id) + "\"><span><strong>" + escape(item.partName) + "</strong><small>Part $" + Number(item.partCost || 0).toFixed(2) + " · Labor $" + Number(item.laborCost || 0).toFixed(2) + "</small></span><b>$" + (Number(item.partCost || 0) + Number(item.laborCost || 0)).toFixed(2) + "</b></label>").join("") +
          "</div><p class=\"owner-estimate-total\">Selected estimate total <strong data-owner-estimate-total>$0.00</strong></p><div class=\"form-message\" data-estimate-message role=\"status\"></div><button class=\"button button-primary button-small\" type=\"submit\">Confirm selected parts</button></form>"
        : "";
      const pickupInfo = request.pickupDate && request.pickupTime
        ? "<p class=\"request-pickup-info\"><strong>Pickup:</strong> " + window.CarCareUI.formatDate(request.pickupDate) + " at " + escape(formatPickupTime(request.pickupTime)) + (request.pickupAddress ? " · " + escape(request.pickupAddress) : "") + "</p>"
        : "";
      return "<article class=\"owner-request-card\" data-request-card=\"" + escape(request.id) + "\">" +
        "<div class=\"owner-request-card-heading\"><div><p class=\"eyebrow\">" + (request.initiatedBy === "center" ? "SERVICE CENTER REQUEST" : "YOUR REQUEST") + "</p><h2>" +
        escape(request.orderNumber || request.id) + "</h2><p>" + escape(vehicle ? vehicle.year + " " + vehicle.vehicleMake + " " + vehicle.carModel : "Vehicle") +
        " · " + escape(centerName) + "</p></div><span class=\"table-status " + (["declined", "cancelled"].includes(request.status) ? "expired" : request.status === "paid" ? "ok" : "due") + "\">" + serviceRequestStatusLabel(request.status) + "</span></div>" +
        (requestedParts.length ? "<p class=\"request-parts-summary\"><strong>Requested checks:</strong> " + escape(requestedParts.join(", ")) + "</p>" : "") +
        (request.issue ? "<p class=\"request-parts-summary\"><strong>Notes:</strong> " + escape(request.issue) + "</p>" : "") + pickupInfo +
        estimateMarkup +
        requestProgressMarkup(request) +
        (isIncoming ? "<div class=\"incoming-request-actions\"><button class=\"button button-primary button-small\" type=\"button\" data-accept-request=\"" + escape(request.id) + "\">Accept and choose pickup</button><button class=\"button button-outline button-small\" type=\"button\" data-decline-request=\"" + escape(request.id) + "\">Decline</button></div>" : "") +
        (canCancel ? "<div class=\"request-cancel-action\"><button class=\"link-button\" type=\"button\" data-cancel-request=\"" + escape(request.id) + "\">Cancel request</button></div>" : "") +
        "<form class=\"center-accept-form hidden\" data-accept-form=\"" + escape(request.id) + "\" novalidate><p class=\"owner-inline-note\">Choose a pickup slot between 8:00 AM and 5:00 PM.</p><label>Pickup date<input name=\"pickupDate\" type=\"date\" min=\"" + escape(localDateString()) + "\" required></label><label>Pickup time<input name=\"pickupTime\" type=\"time\" min=\"08:00\" max=\"17:00\" required></label><label>Pickup address<input name=\"pickupAddress\" type=\"text\" value=\"" + escape(session.address || "") + "\" required></label><div class=\"form-message\" data-accept-message role=\"status\"></div><button class=\"button button-primary button-small\" type=\"submit\">Confirm pickup</button></form>" +
        "</article>";
    }).join("");
    target.innerHTML = html;
  }

  function localDateString() {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  }

  function formatPickupTime(value) {
    const [hours, minutes] = value.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    return (hours % 12 || 12) + ":" + String(minutes).padStart(2, "0") + " " + period;
  }

  function addRequestNotification(recipientId, request, message, type) {
    const notifications = window.CarCareData.get("notifications");
    const key = "request-update-" + request.id + "-" + type + "-" + request.status;
    if (notifications.some((notification) => notification.notificationKey === key)) return;
    notifications.push({
      id: "notification-" + key,
      notificationKey: key,
      recipientId,
      serviceCenterId: request.serviceCenterId,
      type,
      message,
      relatedId: request.id,
      createdAt: new Date().toISOString(),
      read: false,
      simulated: true
    });
    window.CarCareData.save("notifications", notifications);
  }

  function notifyServiceCenter(recipientId, request, message, type) {
    try {
      addRequestNotification(recipientId, request, message, type);
    } catch (error) {
      console.error("Unable to save the service-center notification.", error);
      window.CarCareUI.toast("The request was updated, but the service center notification could not be saved.", "error");
    }
  }

  function initServiceRequestForm() {
    const form = document.getElementById("service-request-form");
    const panel = document.getElementById("service-request-form-panel");
    const dateInput = document.getElementById("request-pickup-date");
    const timeInput = document.getElementById("request-pickup-time");
    dateInput.min = localDateString();

    function openForm(vehicleId) {
      setActiveView("requests");
      document.getElementById("request-confirmation").classList.add("hidden");
      panel.classList.remove("hidden");
      form.reset();
      document.getElementById("request-issue").value = "";
      document.getElementById("request-pickup-address").value = session.address || "";
      document.getElementById("service-request-message").textContent = "";
      updateRequestVehicleChoices(vehicleId);
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    document.getElementById("start-service-request").addEventListener("click", () => openForm(null));
    document.getElementById("request-selected-vehicle-service").addEventListener("click", () => openForm(selectedVehicleId));
    document.getElementById("close-service-request-form").addEventListener("click", () => panel.classList.add("hidden"));
    document.getElementById("cancel-service-request").addEventListener("click", () => panel.classList.add("hidden"));
    document.getElementById("request-vehicle").addEventListener("change", function () {
      renderRequestOptionsForVehicle(this.value);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const vehicle = ownedVehicles.find((item) => item.id === form.elements.vehicleId.value);
      if (!vehicle) {
        document.getElementById("service-request-message").textContent = "Choose one of your approved vehicles.";
        return;
      }
      if (vehicle.approvalStatus === "pending" || vehicle.approvalStatus === "rejected") {
        document.getElementById("service-request-message").textContent = "This vehicle model is not approved for service scheduling.";
        return;
      }
      const dateError = validPickupDateTime(dateInput.value, timeInput.value);
      if (dateError) {
        document.getElementById("service-request-message").textContent = dateError;
        return;
      }
      const pickupAddress = form.elements.pickupAddress.value.trim();
      if (!pickupAddress) {
        document.getElementById("service-request-message").textContent = "Confirm the pickup address.";
        return;
      }
      const selectedPartIds = Array.from(form.querySelectorAll("input[name=\"requestPart\"]:checked")).map((input) => input.value);
      const issue = form.elements.issue.value.trim();
      if (!selectedPartIds.length && !issue) {
        document.getElementById("service-request-message").textContent = "Select at least one part to check or describe an issue.";
        return;
      }
      const selectedCenter = form.querySelector("input[name=\"serviceCenterId\"]:checked");
      if (!selectedCenter) {
        document.getElementById("service-request-message").textContent = "Choose a service center for this request.";
        return;
      }

      const request = {
        id: "request-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        orderNumber: requestOrderNumber(),
        ownerId: session.id,
        vehicleId: vehicle.id,
        serviceCenterId: selectedCenter.value,
        initiatedBy: "owner",
        status: "requested",
        requestedParts: selectedPartIds,
        issue,
        pickupDate: dateInput.value,
        pickupTime: timeInput.value,
        pickupAddress,
        createdAt: new Date().toISOString()
      };
      try {
        window.CarCareData.save("serviceRequests", window.CarCareData.get("serviceRequests").concat(request));
        notifyServiceCenter(request.serviceCenterId, request, "New service request " + request.orderNumber + " from " + (session.ownerName || session.name) + ".", "owner-service-request");
        panel.classList.add("hidden");
        document.getElementById("request-confirmation").classList.remove("hidden");
        document.getElementById("confirmation-order-number").textContent = request.orderNumber;
        document.getElementById("request-confirmation-copy").textContent = "Your pickup request has been sent to " + (window.CarCareData.getServiceCenterName(request.serviceCenterId) || "the selected service center") + ". Requested pickup: " + window.CarCareUI.formatDate(request.pickupDate) + " at " + formatPickupTime(request.pickupTime) + ".";
        refreshNotificationViews();
        renderServiceRequests();
        document.getElementById("owner-request-count").textContent = String(activeOwnerRequests().length);
      } catch (error) {
        document.getElementById("service-request-message").textContent = "Request could not be submitted: " + error.message;
      }
    });

    document.getElementById("view-request-tracker").addEventListener("click", () => {
      setActiveView("requests");
      renderServiceRequests();
      document.getElementById("owner-request-list").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function activeOwnerRequests() {
    return window.CarCareData.get("serviceRequests").filter((request) =>
      request.ownerId === session.id && !["completed", "service-completed", "paid", "declined", "cancelled"].includes(request.status)
    );
  }

  function updateRequest(requestId, changes) {
    const requests = window.CarCareData.get("serviceRequests");
    const request = requests.find((item) => item.id === requestId && item.ownerId === session.id);
    if (!request) throw new Error("This service request was not found in your account.");
    const updated = Object.assign({}, request, changes, { updatedAt: new Date().toISOString() });
    const nextRequests = requests.map((item) => item.id === requestId ? updated : item);
    window.CarCareData.save("serviceRequests", nextRequests);
    return updated;
  }

  function declineCenterRequest(requestId) {
    try {
      const request = updateRequest(requestId, { status: "declined", ownerRespondedAt: new Date().toISOString() });
      notifyServiceCenter(request.serviceCenterId, request, (session.ownerName || session.name) + " declined service request " + request.orderNumber + ".", "owner-response");
      notifyForOwnerActivity();
      renderServiceRequests();
      refreshNotificationViews();
      window.CarCareUI.toast("Request declined. The service center has been notified.", "success");
    } catch (error) {
      window.CarCareUI.toast(error.message, "error");
    }
  }

  function cancelOwnerRequest(requestId) {
    try {
      const request = updateRequest(requestId, { status: "cancelled", cancelledAt: new Date().toISOString() });
      notifyServiceCenter(request.serviceCenterId, request, (session.ownerName || session.name) + " cancelled service request " + request.orderNumber + ".", "owner-response");
      notifyForOwnerActivity();
      renderServiceRequests();
      refreshNotificationViews();
      window.CarCareUI.toast("Service request cancelled.", "success");
    } catch (error) {
      window.CarCareUI.toast(error.message, "error");
    }
  }

  function initRequestActions() {
    const requestList = document.getElementById("owner-request-list");
    requestList.addEventListener("change", function (event) {
      const form = event.target.closest("[data-estimate-confirm]");
      if (!form) return;
      const selected = new Set(Array.from(form.querySelectorAll("input[name=\"approvedEstimateItem\"]:checked")).map((input) => input.value));
      const requests = window.CarCareData.get("serviceRequests");
      const request = requests.find((item) => item.id === form.dataset.estimateConfirm && item.ownerId === session.id);
      const total = request && Array.isArray(request.estimateItems)
        ? request.estimateItems.filter((item) => selected.has(item.id)).reduce((sum, item) => sum + Number(item.partCost || 0) + Number(item.laborCost || 0), 0)
        : 0;
      form.querySelector("[data-owner-estimate-total]").textContent = "$" + total.toFixed(2);
    });
    requestList.addEventListener("click", function (event) {
      const acceptButton = event.target.closest("[data-accept-request]");
      if (acceptButton) {
        const form = this.querySelector("[data-accept-form=\"" + CSS.escape(acceptButton.dataset.acceptRequest) + "\"]");
        if (form) {
          form.classList.toggle("hidden");
          const date = form.elements.pickupDate;
          date.min = localDateString();
          form.elements.pickupAddress.value = session.address || "";
        }
        return;
      }
      const declineButton = event.target.closest("[data-decline-request]");
      if (declineButton) {
        declineCenterRequest(declineButton.dataset.declineRequest);
        return;
      }
      const cancelButton = event.target.closest("[data-cancel-request]");
      if (cancelButton) cancelOwnerRequest(cancelButton.dataset.cancelRequest);
    });
    document.getElementById("owner-request-list").addEventListener("submit", function (event) {
      const estimateForm = event.target.closest("[data-estimate-confirm]");
      if (estimateForm) {
        event.preventDefault();
        const selectedPartsForService = Array.from(estimateForm.querySelectorAll("input[name=\"approvedEstimateItem\"]:checked")).map((input) => input.value);
        const message = estimateForm.querySelector("[data-estimate-message]");
        if (!selectedPartsForService.length) {
          message.textContent = "Select at least one part to confirm.";
          return;
        }
        try {
          const request = updateRequest(estimateForm.dataset.estimateConfirm, {
            status: "parts-confirmed",
            selectedPartsForService,
            ownerConfirmedAt: new Date().toISOString()
          });
          notifyServiceCenter(request.serviceCenterId, request, (session.ownerName || session.name) + " confirmed " + selectedPartsForService.length + " estimate item(s) for " + request.orderNumber + ".", "owner-response");
          renderServiceRequests();
          refreshNotificationViews();
          window.CarCareUI.toast("Selected parts confirmed. The service center can now start work.", "success");
        } catch (error) {
          message.textContent = error.message;
        }
        return;
      }
      const form = event.target.closest("[data-accept-form]");
      if (!form) return;
      event.preventDefault();
      const message = form.querySelector("[data-accept-message]");
      const date = form.elements.pickupDate.value;
      const time = form.elements.pickupTime.value;
      const address = form.elements.pickupAddress.value.trim();
      const dateError = validPickupDateTime(date, time);
      if (dateError) {
        message.textContent = dateError;
        return;
      }
      if (!address) {
        message.textContent = "Confirm the pickup address.";
        return;
      }
      try {
        const request = updateRequest(form.dataset.acceptForm, {
          status: "accepted-by-owner",
          pickupDate: date,
          pickupTime: time,
          pickupAddress: address,
          ownerRespondedAt: new Date().toISOString()
        });
        notifyServiceCenter(request.serviceCenterId, request, (session.ownerName || session.name) + " accepted " + request.orderNumber + " and selected a pickup time.", "owner-response");
        notifyForOwnerActivity();
        renderServiceRequests();
        refreshNotificationViews();
        window.CarCareUI.toast("Service request accepted. The pickup is scheduled.", "success");
      } catch (error) {
        message.textContent = error.message;
      }
    });
  }

  function initVehicleForm() {
    const form = document.getElementById("add-vehicle-form");
    const manualToggle = document.getElementById("unlisted-model");
    const manualFields = document.getElementById("manual-model-fields");
    const catalogFields = document.getElementById("catalog-model-fields");
    const catalogMake = document.getElementById("catalog-make");
    const catalogModel = document.getElementById("catalog-model");
    const catalogYear = document.getElementById("catalog-year");
    const manualMake = document.getElementById("manual-make");
    const manualModel = document.getElementById("manual-model");
    const manualYear = document.getElementById("manual-year");

    populateCatalogSelects();
    catalogMake.addEventListener("change", updateModels);
    catalogModel.addEventListener("change", updateYears);
    manualToggle.addEventListener("change", function () {
      const unlisted = manualToggle.checked;
      manualFields.classList.toggle("hidden", !unlisted);
      catalogFields.classList.toggle("hidden", unlisted);
      catalogMake.required = !unlisted;
      catalogModel.required = !unlisted;
      catalogYear.required = !unlisted;
      manualMake.required = unlisted;
      manualModel.required = unlisted;
      manualYear.required = unlisted;
    });

    document.getElementById("show-add-vehicle").addEventListener("click", function () {
      document.getElementById("add-vehicle-panel").classList.remove("hidden");
      document.getElementById("add-vehicle-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.getElementById("cancel-add-vehicle").addEventListener("click", function () {
      form.reset();
      document.getElementById("add-vehicle-panel").classList.add("hidden");
      manualToggle.dispatchEvent(new Event("change"));
      populateCatalogSelects();
      document.getElementById("add-vehicle-message").textContent = "";
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const vehicleNumber = form.elements.vehicleNumber.value.trim();
      const unlisted = manualToggle.checked;
      const make = unlisted ? manualMake.value.trim() : catalogMake.value;
      const model = unlisted ? manualModel.value.trim() : catalogModel.value;
      const year = Number(unlisted ? manualYear.value : catalogYear.value);
      if (!vehicleNumber || !make || !model || !Number.isInteger(year)) {
        document.getElementById("add-vehicle-message").textContent = "Complete all required vehicle details.";
        return;
      }
      if (year < 1900 || year > new Date().getFullYear() + 1) {
        document.getElementById("add-vehicle-message").textContent = "Enter a valid vehicle year.";
        return;
      }
      const duplicate = ownedVehicles.some((vehicle) => vehicle.vehicleNumber.toLowerCase() === vehicleNumber.toLowerCase());
      if (duplicate) {
        document.getElementById("add-vehicle-message").textContent = "That vehicle number is already in your garage.";
        return;
      }
      const vehicle = {
        id: "vehicle-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        ownerId: session.id,
        vehicleNumber,
        vehicleMake: make,
        carModel: model,
        year,
        approvalStatus: unlisted ? "pending" : "approved"
      };
      try {
        window.CarCareData.save("vehicles", window.CarCareData.get("vehicles").concat(vehicle));
        ownedVehicles.push(vehicle);
        renderVehicles();
        form.reset();
        manualToggle.dispatchEvent(new Event("change"));
        populateCatalogSelects();
        document.getElementById("add-vehicle-panel").classList.add("hidden");
        document.getElementById("owner-vehicle-count").textContent = String(ownedVehicles.length);
        if (unlisted) {
          window.CarCareUI.toast("Vehicle saved as Pending admin review. It cannot be scheduled for service until approved.", "success");
        } else {
          window.CarCareUI.toast("Vehicle added to your garage.", "success");
        }
      } catch (error) {
        document.getElementById("add-vehicle-message").textContent = error.message;
      }
    });
  }

  function init() {
    session = window.CarCareAuth.requireRole("owner");
    if (!session) return;
    const account = window.CarCareData.getOwnerProfile(session.id);
    if (!account || account.role !== "owner") return;
    session = Object.assign({}, session, account);
    ownedVehicles = window.CarCareData.get("vehicles").filter((vehicle) => vehicle.ownerId === session.id);
    vehicleCatalog = window.CarCareData.get("vehicleModels");

    document.getElementById("owner-welcome-name").textContent = session.ownerName || session.name.split(" ")[0];
    document.getElementById("owner-vehicle-count").textContent = String(ownedVehicles.length);
    notifyForOwnerActivity();
    refreshNotificationViews();
    renderVehicles();
    initVehicleForm();
    initServiceRequestForm();
    initRequestActions();

    const reminders = getOwnerParts().map((part) => ({ part, status: partStatus(part) }))
      .filter(({ status }) => status.remaining !== null && status.remaining <= 30);
    if (reminders.length) {
      document.getElementById("reminder-banner").classList.remove("hidden");
      document.getElementById("reminder-banner-title").textContent = reminders.length + " part" + (reminders.length === 1 ? " needs" : "s need") + " your attention";
      document.getElementById("reminder-banner-text").textContent = reminders.map(({ part, status }) =>
        part.partName + (status.remaining < 0 ? " (expired)" : status.remaining === 0 ? " (expires today)" : " (" + status.remaining + " days)")
      ).join(" · ");
    }

    document.querySelectorAll("[data-owner-tab]").forEach((control) => {
      control.addEventListener("click", function () {
        setActiveView(control.dataset.ownerTab);
      });
    });
    document.addEventListener("click", function (event) {
      const vehicleButton = event.target.closest("[data-open-vehicle]");
      if (vehicleButton) {
        setActiveView("vehicles");
        renderVehicleDetails(vehicleButton.dataset.openVehicle);
        document.getElementById("vehicle-details-panel").scrollIntoView({ behavior: "smooth", block: "start" });
      }
      const readButton = event.target.closest("[data-mark-read]");
      if (readButton) markNotificationRead(readButton.dataset.markRead);
    });
    document.getElementById("close-vehicle-details").addEventListener("click", function () {
      selectedVehicleId = null;
      document.getElementById("vehicle-details-panel").classList.add("hidden");
    });
    document.getElementById("mark-all-read").addEventListener("click", markAllNotificationsRead);
    setActiveView("dashboard");
  }

  function markNotificationRead(notificationId) {
    try {
      const notifications = window.CarCareData.get("notifications").map((notification) =>
        notification.id === notificationId && notification.recipientId === session.id
          ? Object.assign({}, notification, { read: true })
          : notification
      );
      window.CarCareData.save("notifications", notifications);
      refreshNotificationViews();
    } catch (error) {
      window.CarCareUI.toast(error.message, "error");
    }
  }

  function markAllNotificationsRead() {
    try {
      const notifications = window.CarCareData.get("notifications").map((notification) =>
        notification.recipientId === session.id ? Object.assign({}, notification, { read: true }) : notification
      );
      window.CarCareData.save("notifications", notifications);
      refreshNotificationViews();
    } catch (error) {
      window.CarCareUI.toast(error.message, "error");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    try {
      init();
    } catch (error) {
      console.error("Unable to load the owner portal.", error);
      const errorBox = document.getElementById("owner-page-error");
      if (errorBox) {
        errorBox.textContent = "The owner portal could not load your data. " + error.message;
        errorBox.classList.remove("hidden");
      }
    }
  });
}());
