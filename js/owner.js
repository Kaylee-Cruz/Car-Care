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
      if (existingKeys.has(key)) return;
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
        let message = centerName + " sent a service request.";
        if (request.status === "estimate-ready") {
          type = "estimate-ready";
          message = centerName + " has prepared a service estimate for your vehicle.";
        } else if (request.status === "service-completed" || request.status === "completed") {
          type = "service-completed";
          message = centerName + " marked your service as complete.";
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
    if (viewName === "history") renderHistory();
    if (viewName === "profile") renderProfile();
    window.scrollTo(0, 0);
  }

  function refreshNotificationViews() {
    const notifications = ownerNotifications();
    const unreadCount = notifications.filter((notification) => !notification.read).length;
    setUnreadCount(unreadCount);
    document.getElementById("owner-request-count").textContent = window.CarCareData.get("serviceRequests")
      .filter((request) => request.ownerId === session.id && !["completed", "service-completed", "cancelled", "declined"].includes(request.status)).length;
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
