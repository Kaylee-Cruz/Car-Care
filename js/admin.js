(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    const session = window.CarCareAuth.requireRole("admin");
    if (!session) return;

    const data = window.CarCareData;
    const ui = window.CarCareUI;
    const currentYear = new Date().getFullYear();
    const openStatuses = ["requested", "accepted-by-owner", "inspection-pending", "estimate-ready", "parts-confirmed", "in-service", "service-completed"];
    const html = ui.escapeHtml;
    const dateOnly = () => new Date().toISOString().slice(0, 10);
    const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0);
    const formatDate = (value) => value ? ui.formatDate(String(value).slice(0, 10)) : "—";
    const id = (prefix) => prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

    function current(collection) {
      return data.get(collection);
    }

    function serviceCenters() {
      const users = current("users");
      const ids = Array.from(new Set(users.filter((user) => user.serviceCenterId).map((user) => user.serviceCenterId)));
      return ids.map((centerId) => {
        const centerUsers = users.filter((user) => user.serviceCenterId === centerId);
        const manager = centerUsers.find((user) => user.role === "manager");
        const representative = manager || centerUsers[0];
        return {
          id: centerId,
          name: representative.serviceCenterName || representative.name,
          address: representative.serviceCenterAddress || ""
        };
      });
    }

    function renderDashboard() {
      const users = current("users");
      const vehicles = current("vehicles");
      const requests = current("serviceRequests");
      const history = current("serviceHistory");
      const reports = current("reports");
      const payments = current("payments");
      document.getElementById("admin-user-count").textContent = users.length;
      document.getElementById("admin-vehicle-count").textContent = vehicles.length;
      document.getElementById("admin-open-request-count").textContent = requests.filter((request) => openStatuses.includes(request.status)).length;
      document.getElementById("admin-completed-service-count").textContent = history.filter((service) => service.serviceCompleted).length;
      document.getElementById("admin-total-payments").textContent = money(payments.filter((payment) => payment.paymentSuccessful).reduce((total, payment) => total + Number(payment.amount || 0), 0));
      document.getElementById("admin-open-report-count").textContent = reports.filter((report) => !["reviewed", "action-taken"].includes(report.status)).length;
      document.getElementById("admin-pending-vehicle-count").textContent = vehicles.filter((vehicle) => vehicle.approvalStatus === "pending").length;
    }

    function renderUserCenterOptions() {
      const select = document.getElementById("admin-user-center");
      const centers = serviceCenters();
      select.innerHTML = centers.length
        ? centers.map((center) => "<option value=\"" + html(center.id) + "\">" + html(center.name) + "</option>").join("")
        : "<option value=\"\">No service centers available</option>";
      const form = document.getElementById("admin-create-user");
      const role = form.elements.role.value;
      const centerField = form.querySelector(".admin-center-field");
      centerField.hidden = role === "admin";
      select.required = role !== "admin";
      select.disabled = role === "admin" || centers.length === 0;
    }

    function renderUsers() {
      const users = current("users");
      document.getElementById("admin-accounts").innerHTML = users.map((user) => {
        const role = user.role === "center" ? "Service Center" : user.role.charAt(0).toUpperCase() + user.role.slice(1);
        const maskedSsn = user.role === "owner" ? ui.maskSsn(user.ssn || "") : "—";
        const status = user.disabled ? "Disabled" : "Enabled";
        const self = user.id === session.id;
        return "<tr><td><strong>" + html(user.name || user.ownerName || user.serviceCenterName || "Unnamed user") + "</strong></td><td>" + html(role) + "</td><td>" + html(user.email) + "</td><td>" + html(maskedSsn) + "</td><td><span class=\"admin-status-badge " + (user.disabled ? "is-disabled" : "is-enabled") + "\">" + status + "</span></td><td class=\"admin-action-cell\">" +
          "<button class=\"link-button\" type=\"button\" data-admin-action=\"toggle-user\" data-user-id=\"" + html(user.id) + "\"" + (self ? " disabled title=\"You cannot disable your current account\"" : "") + ">" + (user.disabled ? "Enable" : "Disable") + "</button> " +
          "<button class=\"link-button\" type=\"button\" data-admin-action=\"reset-password\" data-user-id=\"" + html(user.id) + "\">Reset password</button></td></tr>";
      }).join("");
    }

    function renderSecurity() {
      const admins = current("users").filter((user) => user.role === "admin");
      document.getElementById("admin-security").innerHTML = admins.length ? admins.map((admin) => {
        const self = admin.id === session.id;
        const state = admin.mfaSecret ? "Enabled" : "Not configured";
        return "<tr><td><strong>" + html(admin.name) + "</strong></td><td>" + html(admin.email) + "</td><td><span class=\"admin-status-badge " + (admin.mfaSecret ? "is-enabled" : "is-disabled") + "\">" + state + "</span></td><td>" + html(formatDate(admin.mfaResetAt)) + "</td><td><button class=\"link-button\" type=\"button\" data-admin-action=\"reset-mfa\" data-user-id=\"" + html(admin.id) + "\"" + (self ? " disabled title=\"Another admin must reset your device\"" : "") + ">Reset 2-step device</button></td></tr>";
      }).join("") : "<tr><td colspan=\"5\">No admin accounts found.</td></tr>";
    }

    function renderCatalog() {
      const models = current("vehicleModels").slice().sort((left, right) =>
        left.make.localeCompare(right.make) || left.model.localeCompare(right.model) || Number(left.year) - Number(right.year)
      );
      document.getElementById("admin-model-count").textContent = String(models.length);
      document.getElementById("admin-models").innerHTML = models.length ? models.map((model) =>
        "<tr><td>" + html(model.make) + "</td><td>" + html(model.model) + "</td><td>" + html(model.year) + "</td><td>" + html(formatDate(model.updatedAt || dateOnly())) + "</td></tr>"
      ).join("") : "<tr><td colspan=\"4\">No vehicle models are in the catalog yet.</td></tr>";
      const latestUpdate = models.reduce((latest, model) => {
        const updated = String(model.updatedAt || "");
        return updated > latest ? updated : latest;
      }, "");
      document.getElementById("admin-model-updated").textContent = formatDate(latestUpdate || dateOnly());

      const years = Array.from(new Set(models.map((model) => Number(model.year)))).sort((a, b) => b - a);
      const sourceSelect = document.getElementById("admin-source-year");
      sourceSelect.innerHTML = years.length
        ? years.map((year) => "<option value=\"" + year + "\">" + year + "</option>").join("")
        : "<option value=\"\">No catalog years available</option>";
      document.getElementById("admin-import-year").elements.targetYear.min = String(Math.min(...years, currentYear));
    }

    function renderPendingVehicles() {
      const users = current("users");
      const pending = current("vehicles").filter((vehicle) => vehicle.approvalStatus === "pending");
      document.getElementById("admin-pending-vehicles").innerHTML = pending.length ? pending.map((vehicle) => {
        const owner = users.find((user) => user.id === vehicle.ownerId);
        return "<tr><td>" + html(owner ? owner.ownerName || owner.name : "Owner") + "</td><td>" + html(vehicle.vehicleNumber) + "</td><td>" + html(vehicle.vehicleMake + " " + vehicle.carModel) + "</td><td>" + html(vehicle.year) + "</td><td class=\"admin-action-cell\"><button class=\"link-button\" type=\"button\" data-admin-action=\"approve-vehicle\" data-vehicle-id=\"" + html(vehicle.id) + "\">Approve</button> <button class=\"link-button admin-danger-link\" type=\"button\" data-admin-action=\"reject-vehicle\" data-vehicle-id=\"" + html(vehicle.id) + "\">Reject</button></td></tr>";
      }).join("") : "<tr><td colspan=\"5\">There are no vehicles awaiting review.</td></tr>";
    }

    function renderReports() {
      const users = current("users");
      const requests = current("serviceRequests");
      const vehicles = current("vehicles");
      const reports = current("reports").slice().sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
      const target = document.getElementById("admin-reports");
      target.innerHTML = reports.length ? reports.map((report) => {
        const owner = users.find((user) => user.id === report.ownerId);
        const request = requests.find((item) => item.id === report.serviceRequestId);
        const vehicle = vehicles.find((item) => item.id === (request || {}).vehicleId);
        const centerName = data.getServiceCenterName(report.serviceCenterId) || "Service center";
        const type = report.type === "complaint" ? "Complaint" : "Positive Feedback";
        const status = report.status === "action-taken" ? "Action Taken" : report.status === "reviewed" ? "Reviewed" : "Open";
        return "<article class=\"admin-report-card\"><div class=\"admin-report-heading\"><div><p class=\"eyebrow\">" + html(type) + "</p><h3>" + html(report.orderNumber || "Service report") + "</h3></div><span class=\"admin-report-rating\">" + "★".repeat(Math.max(0, Math.min(5, Number(report.rating) || 0))) + "<small> " + Number(report.rating) + "/5</small></span></div>" +
          "<p class=\"admin-report-message\">" + html(report.message || "") + "</p><div class=\"admin-report-meta\"><span>From " + html(owner ? owner.ownerName || owner.name : "Owner") + "</span><span>" + html(vehicle ? vehicle.year + " " + vehicle.vehicleMake + " " + vehicle.carModel + " · " + vehicle.vehicleNumber : "Vehicle") + "</span><span>" + html(centerName) + "</span><span>" + html(formatDate(report.createdAt)) + "</span><span class=\"admin-status-badge " + (report.status ? "is-enabled" : "") + "\">" + status + "</span></div>" +
          "<form class=\"admin-report-action\" data-report-id=\"" + html(report.id) + "\"><label>Admin note<textarea name=\"adminNote\" rows=\"2\" required>" + html(report.adminNote || "") + "</textarea></label><div><button class=\"button button-quiet\" type=\"submit\" name=\"status\" value=\"reviewed\">Mark Reviewed</button><button class=\"button button-outline\" type=\"submit\" name=\"status\" value=\"action-taken\">Action Taken</button></div><p class=\"admin-form-message\" role=\"status\"></p></form></article>";
      }).join("") : "<div class=\"center-empty-state\">No owner reports have been submitted yet.</div>";
    }

    function renderServiceCenters() {
      const centers = serviceCenters();
      const history = current("serviceHistory");
      const reports = current("reports");
      const rows = centers.map((center) => {
        const centerReports = reports.filter((report) => report.serviceCenterId === center.id && Number.isFinite(Number(report.rating)));
        const average = centerReports.length
          ? (centerReports.reduce((total, report) => total + Number(report.rating), 0) / centerReports.length).toFixed(1) + " / 5"
          : "No ratings";
        return "<tr><td><strong>" + html(center.name) + "</strong></td><td>" + history.filter((service) => service.serviceCenterId === center.id && service.serviceCompleted).length + "</td><td>" + html(average) + "</td></tr>";
      });
      document.getElementById("admin-centers").innerHTML = rows.length ? rows.join("") : "<tr><td colspan=\"3\">No service centers are registered.</td></tr>";
    }

    function render() {
      renderDashboard();
      renderUserCenterOptions();
      renderUsers();
      renderSecurity();
      renderCatalog();
      renderPendingVehicles();
      renderReports();
      renderServiceCenters();
    }

    function showMessage(idValue, message, isError) {
      const element = document.getElementById(idValue);
      element.textContent = message;
      element.classList.toggle("is-error", Boolean(isError));
    }

    function modelExists(models, make, model, year) {
      return models.some((item) => item.make.toLowerCase() === make.toLowerCase() &&
        item.model.toLowerCase() === model.toLowerCase() && Number(item.year) === Number(year));
    }

    document.getElementById("admin-create-user").addEventListener("change", function (event) {
      if (event.target.name === "role") renderUserCenterOptions();
    });

    document.getElementById("admin-create-user").addEventListener("submit", function (event) {
      event.preventDefault();
      const form = event.currentTarget;
      const name = form.elements.name.value.trim();
      const email = form.elements.email.value.trim().toLowerCase();
      const password = form.elements.password.value;
      const role = form.elements.role.value;
      const centerId = form.elements.serviceCenterId.value;
      if (!name || !email || password.length < 6 || !["manager", "technician", "admin"].includes(role)) {
        showMessage("admin-user-message", "Enter a name, valid email, and password of at least 6 characters.", true);
        return;
      }
      if (current("users").some((user) => user.email.toLowerCase() === email)) {
        showMessage("admin-user-message", "An account with this email already exists.", true);
        return;
      }
      const center = role === "admin" ? null : serviceCenters().find((item) => item.id === centerId);
      if (role !== "admin" && !center) {
        showMessage("admin-user-message", "Select an existing service center for this account.", true);
        return;
      }
      const account = {
        id: id(role),
        name,
        email,
        password,
        role,
        disabled: false
      };
      if (center) {
        account.serviceCenterId = center.id;
        account.serviceCenterName = center.name;
        account.serviceCenterAddress = center.address;
      }
      if (role === "admin") account.mfaSecret = "CARCARE-" + account.id + "-" + Math.random().toString(36).slice(2, 12);
      try {
        data.addUser(account);
        form.reset();
        render();
        showMessage("admin-user-message", "Individual " + role + " account created.", false);
      } catch (error) {
        showMessage("admin-user-message", error.message, true);
      }
    });

    document.getElementById("admin-add-model").addEventListener("submit", function (event) {
      event.preventDefault();
      const form = event.currentTarget;
      const make = form.elements.make.value.trim();
      const model = form.elements.model.value.trim();
      const year = Number(form.elements.year.value);
      if (!make || !model || !Number.isInteger(year) || year < 1900 || year > currentYear + 2) {
        showMessage("admin-model-message", "Enter a make, model, and valid model year.", true);
        return;
      }
      const models = current("vehicleModels");
      if (modelExists(models, make, model, year)) {
        showMessage("admin-model-message", "That make, model, and year is already in the catalog.", true);
        return;
      }
      try {
        data.save("vehicleModels", models.concat({ id: id("model"), make, model, year, updatedAt: dateOnly() }));
        form.reset();
        renderCatalog();
        showMessage("admin-model-message", "Vehicle model added to the catalog.", false);
      } catch (error) {
        showMessage("admin-model-message", error.message, true);
      }
    });

    document.getElementById("admin-import-year").addEventListener("submit", function (event) {
      event.preventDefault();
      const form = event.currentTarget;
      const sourceYear = Number(form.elements.sourceYear.value);
      const targetYear = Number(form.elements.targetYear.value);
      const models = current("vehicleModels");
      const sourceModels = models.filter((model) => Number(model.year) === sourceYear);
      if (!sourceModels.length) {
        showMessage("admin-import-message", "Choose a model year with catalog entries to copy.", true);
        return;
      }
      if (!Number.isInteger(targetYear) || targetYear < 1900 || targetYear > currentYear + 2 || targetYear === sourceYear) {
        showMessage("admin-import-message", "Enter a valid new year that differs from the source year.", true);
        return;
      }
      const newModels = sourceModels.filter((source) => !modelExists(models, source.make, source.model, targetYear))
        .map((source) => ({ id: id("model"), make: source.make, model: source.model, year: targetYear, updatedAt: dateOnly() }));
      if (!newModels.length) {
        showMessage("admin-import-message", "All models for that year already exist in the catalog.", true);
        return;
      }
      try {
        data.save("vehicleModels", models.concat(newModels));
        form.elements.targetYear.value = "";
        renderCatalog();
        showMessage("admin-import-message", newModels.length + " model(s) imported for " + targetYear + ".", false);
      } catch (error) {
        showMessage("admin-import-message", error.message, true);
      }
    });

    document.getElementById("admin-accounts").addEventListener("click", function (event) {
      const button = event.target.closest("[data-admin-action]");
      if (!button) return;
      const users = current("users");
      const account = users.find((user) => user.id === button.dataset.userId);
      if (!account) return;
      const action = button.dataset.adminAction;
      if (action === "toggle-user") {
        if (account.id === session.id) return;
        account.disabled = !account.disabled;
        data.save("users", users);
        render();
        ui.toast(account.disabled ? "Account disabled." : "Account enabled.", "success");
      } else if (action === "reset-password") {
        const password = window.prompt("Enter a new password for " + account.name + " (at least 6 characters):");
        if (password === null) return;
        if (password.length < 6) {
          ui.toast("Password must be at least 6 characters.", "error");
          return;
        }
        account.password = password;
        data.save("users", users);
        ui.toast("Password reset for " + account.name + ".", "success");
      }
    });

    document.getElementById("admin-security").addEventListener("click", function (event) {
      const button = event.target.closest("[data-admin-action=\"reset-mfa\"]");
      if (!button) return;
      const users = current("users");
      const account = users.find((user) => user.id === button.dataset.userId && user.role === "admin");
      if (!account || account.id === session.id) return;
      if (!window.confirm("Reset the 2-step device for " + account.name + "? This must be done by another admin.")) return;
      account.mfaSecret = "CARCARE-" + account.id + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      account.mfaResetAt = new Date().toISOString();
      data.save("users", users);
      renderSecurity();
      ui.toast("2-step device reset. " + account.name + " must use the new simulated authenticator.", "success");
    });

    document.getElementById("admin-pending-vehicles").addEventListener("click", function (event) {
      const button = event.target.closest("[data-admin-action]");
      if (!button) return;
      const vehicles = current("vehicles");
      const vehicle = vehicles.find((item) => item.id === button.dataset.vehicleId && item.approvalStatus === "pending");
      if (!vehicle) return;
      const action = button.dataset.adminAction;
      if (action === "approve-vehicle") {
        const models = current("vehicleModels");
        if (!modelExists(models, vehicle.vehicleMake, vehicle.carModel, vehicle.year)) {
          models.push({ id: id("model"), make: vehicle.vehicleMake, model: vehicle.carModel, year: Number(vehicle.year), updatedAt: dateOnly() });
          data.save("vehicleModels", models);
        }
        vehicle.approvalStatus = "approved";
        vehicle.reviewedAt = new Date().toISOString();
        data.save("vehicles", vehicles);
        render();
        ui.toast("Vehicle approved and its model is available for scheduling.", "success");
      } else if (action === "reject-vehicle") {
        vehicle.approvalStatus = "rejected";
        vehicle.reviewedAt = new Date().toISOString();
        data.save("vehicles", vehicles);
        render();
        ui.toast("Vehicle submission rejected.", "success");
      }
    });

    document.getElementById("admin-reports").addEventListener("submit", function (event) {
      const form = event.target.closest("[data-report-id]");
      if (!form) return;
      event.preventDefault();
      const submitter = event.submitter;
      const status = submitter && submitter.value;
      const note = form.elements.adminNote.value.trim();
      const message = form.querySelector(".admin-form-message");
      if (!["reviewed", "action-taken"].includes(status)) {
        message.textContent = "Choose Reviewed or Action Taken.";
        return;
      }
      if (!note) {
        message.textContent = "Add a note before updating this report.";
        message.classList.add("is-error");
        return;
      }
      const reports = current("reports");
      const report = reports.find((item) => item.id === form.dataset.reportId);
      if (!report) return;
      report.status = status;
      report.adminNote = note;
      report.reviewedAt = new Date().toISOString();
      try {
        data.save("reports", reports);
        render();
        ui.toast(status === "reviewed" ? "Report marked as reviewed." : "Report marked as action taken.", "success");
      } catch (error) {
        message.textContent = "Report could not be updated: " + error.message;
        message.classList.add("is-error");
      }
    });

    window.addEventListener("storage", function (event) {
      if (event.key !== "carcare.prototype.data.v2") return;
      render();
    });

    render();
  });
}());
