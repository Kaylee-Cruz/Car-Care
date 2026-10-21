(function () {
  "use strict";

  const SESSION_KEY = "carcare.prototype.session.v1";
  const FLASH_KEY = "carcare.prototype.login-message";
  const routes = { owner: "owner.html", center: "center.html", manager: "center.html", technician: "center.html", admin: "admin.html" };

  function getSession() {
    try {
      const value = window.localStorage.getItem(SESSION_KEY);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error("Unable to read the Car Care session.", error);
      return null;
    }
  }

  function setSession(user, mfaVerified) {
    try {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        serviceCenterId: user.serviceCenterId || null,
        mfaVerified: user.role === "admin" && Boolean(mfaVerified)
      }));
    } catch (error) {
      console.error("Unable to save the Car Care session.", error);
      throw new Error("Your browser could not save your session.");
    }
  }

  function setLoginMessage(message) {
    try {
      window.sessionStorage.setItem(FLASH_KEY, message);
    } catch (error) {
      console.error("Unable to save the login message.", error);
    }
  }

  function showMessage(id, message, success) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("success", Boolean(success));
  }

  function routeFor(user) {
    return routes[user.role] || "login.html";
  }

  function logout() {
    window.localStorage.removeItem(SESSION_KEY);
    window.location.href = "login.html";
  }

  function requireRole(expectedRole) {
    const session = getSession();
    const user = session && window.CarCareData.get("users").find((account) => account.id === session.id);
    if (!session || !user || user.disabled) {
      window.localStorage.removeItem(SESSION_KEY);
      setLoginMessage(user && user.disabled ? "This account has been disabled. Contact an administrator." : "Please log in to continue.");
      window.location.replace("login.html");
      return null;
    }
    if (session.role !== user.role || (user.role === "admin" && !session.mfaVerified)) {
      window.localStorage.removeItem(SESSION_KEY);
      setLoginMessage("Please log in and complete the required verification step.");
      window.location.replace("login.html");
      return null;
    }
    const allowed = user.role === expectedRole ||
      (expectedRole === "center" && ["manager", "technician", "center"].includes(user.role));
    if (!allowed) {
      setLoginMessage("Your account does not have access to that portal.");
      window.location.replace("login.html");
      return null;
    }
    document.querySelectorAll("[data-role-only]").forEach((element) => {
      const allowedRoles = element.dataset.roleOnly.split(",").map((role) => role.trim());
      element.hidden = !allowedRoles.includes(session.role);
    });
    const greeting = document.getElementById("user-greeting");
    if (greeting) greeting.textContent = session.name;
    return session;
  }

  function makeAuthenticatorCode(secret, time = Date.now()) {
    const counter = Math.floor(time / 30000);
    let hash = 2166136261;
    const input = secret + ":" + counter;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return String((hash >>> 0) % 1000000).padStart(6, "0");
  }

  function initLogin() {
    const form = document.getElementById("login-form");
    if (!form) return;
    const emailField = form.elements.email;
    const passwordField = form.elements.password;
    const mfaScreen = document.getElementById("mfa-screen");
    const mfaField = document.getElementById("mfa-code");
    const credentialsScreen = document.getElementById("credentials-screen");
    let pendingAdmin = null;
    let authenticatorTimer = null;

    try {
      const flashMessage = window.sessionStorage.getItem(FLASH_KEY);
      if (flashMessage) {
        showMessage("login-message", flashMessage, false);
        window.sessionStorage.removeItem(FLASH_KEY);
      }
    } catch (error) {
      console.error("Unable to read the login message.", error);
    }

    function showAuthenticator(user) {
      pendingAdmin = user;
      credentialsScreen.classList.add("hidden");
      mfaScreen.classList.remove("hidden");
      document.getElementById("authenticator-owner").textContent = user.name;
      mfaField.focus();

      const refreshCode = function () {
        const currentTime = Date.now();
        const remaining = 30 - Math.floor((currentTime % 30000) / 1000);
        document.getElementById("authenticator-code").textContent = makeAuthenticatorCode(user.mfaSecret, currentTime);
        document.getElementById("authenticator-countdown").textContent = "Refreshes in " + remaining + " seconds";
      };
      refreshCode();
      authenticatorTimer = window.setInterval(refreshCode, 1000);
    }

    function returnToCredentials() {
      pendingAdmin = null;
      mfaScreen.classList.add("hidden");
      credentialsScreen.classList.remove("hidden");
      mfaField.value = "";
      showMessage("mfa-message", "", false);
      if (authenticatorTimer) window.clearInterval(authenticatorTimer);
    }

    function finishLogin(user, mfaVerified) {
      try {
        setSession(user, mfaVerified);
        window.location.href = routeFor(user);
      } catch (error) {
        showMessage("login-message", error.message, false);
      }
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const email = emailField.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showMessage("login-message", "Enter a valid email address.", false);
        return;
      }
      const user = window.CarCareData.findUser(email);
      if (!user) {
        showMessage("login-message", "Email or password is incorrect.", false);
        return;
      }
      if (user.disabled) {
        showMessage("login-message", "This account has been disabled. Contact an administrator.", false);
        return;
      }
      if (user.password !== passwordField.value) {
        showMessage("login-message", "Email or password is incorrect.", false);
        document.getElementById("forgot-password-link").classList.remove("hidden");
        return;
      }
      if (user.role === "admin") {
        showAuthenticator(user);
        return;
      }
      finishLogin(user);
    });

    document.getElementById("mfa-form").addEventListener("submit", function (event) {
      event.preventDefault();
      if (!pendingAdmin || !/^\d{6}$/.test(mfaField.value.trim()) ||
          mfaField.value.trim() !== makeAuthenticatorCode(pendingAdmin.mfaSecret)) {
        showMessage("mfa-message", "That code is incorrect or has expired. Enter the current authenticator code.", false);
        mfaField.focus();
        return;
      }
      if (authenticatorTimer) window.clearInterval(authenticatorTimer);
      finishLogin(pendingAdmin, true);
    });

    document.getElementById("mfa-back").addEventListener("click", returnToCredentials);
    document.getElementById("lost-device-link").addEventListener("click", function (event) {
      event.preventDefault();
      document.getElementById("recovery-message").classList.toggle("hidden");
    });
  }

  function initPasswordReset() {
    const openLink = document.getElementById("forgot-password-link");
    if (!openLink) return;
    const resetPanel = document.getElementById("reset-panel");
    const resetEmailForm = document.getElementById("reset-email-form");
    const newPasswordForm = document.getElementById("new-password-form");
    let resetUserId = null;

    openLink.addEventListener("click", function (event) {
      event.preventDefault();
      document.getElementById("credentials-screen").classList.add("hidden");
      resetPanel.classList.remove("hidden");
      document.getElementById("reset-email").value = document.getElementById("login-email").value.trim();
    });

    document.getElementById("reset-cancel").addEventListener("click", function () {
      resetPanel.classList.add("hidden");
      document.getElementById("credentials-screen").classList.remove("hidden");
    });

    resetEmailForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const email = resetEmailForm.elements.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showMessage("reset-email-message", "Enter a valid email address.", false);
        return;
      }
      const user = window.CarCareData.findUser(email);
      if (!user) {
        showMessage("reset-email-message", "No account was found for that email address.", false);
        return;
      }
      if (user.disabled) {
        showMessage("reset-email-message", "This account has been disabled. Contact an administrator.", false);
        return;
      }
      resetUserId = user.id;
      showMessage("reset-email-message", "Simulated reset link sent. Continue below to set a new password.", true);
      document.getElementById("reset-sent-step").classList.remove("hidden");
    });

    document.getElementById("continue-reset").addEventListener("click", function () {
      resetEmailForm.classList.add("hidden");
      document.getElementById("reset-sent-step").classList.add("hidden");
      newPasswordForm.classList.remove("hidden");
    });

    newPasswordForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!resetUserId) {
        showMessage("new-password-message", "Request a reset link before setting a new password.", false);
        return;
      }
      const password = newPasswordForm.elements.password.value;
      const confirmPassword = newPasswordForm.elements.confirmPassword.value;
      if (password.length < 8) {
        showMessage("new-password-message", "Password must be at least 8 characters.", false);
        return;
      }
      if (password !== confirmPassword) {
        showMessage("new-password-message", "Passwords do not match.", false);
        return;
      }
      const users = window.CarCareData.get("users");
      const updatedUsers = users.map((user) => user.id === resetUserId ? Object.assign({}, user, { password }) : user);
      try {
        window.CarCareData.save("users", updatedUsers);
        newPasswordForm.classList.add("hidden");
        showMessage("reset-complete-message", "Password updated in this browser. You can now log in.", true);
        document.getElementById("reset-complete").classList.remove("hidden");
      } catch (error) {
        showMessage("new-password-message", error.message, false);
      }
    });

    document.getElementById("reset-finish").addEventListener("click", function () {
      resetPanel.classList.add("hidden");
      document.getElementById("reset-complete").classList.add("hidden");
      resetEmailForm.classList.remove("hidden");
      newPasswordForm.reset();
      resetEmailForm.reset();
      resetUserId = null;
      document.getElementById("credentials-screen").classList.remove("hidden");
      document.getElementById("forgot-password-link").classList.add("hidden");
    });
  }

  function makeId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return prefix + "-" + window.crypto.randomUUID();
    return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  }

  function initRegistration() {
    const form = document.getElementById("register-form");
    if (!form) return;
    const roleSelect = form.elements.role;
    const ownerFields = document.getElementById("owner-fields");
    const centerFields = document.getElementById("center-fields");
    const confirmation = document.getElementById("registration-confirmation");
    const firstVehiclePanel = document.getElementById("first-vehicle-panel");
    let newlyRegisteredUser = null;

    function updateRoleFields() {
      const ownerSelected = roleSelect.value === "owner";
      ownerFields.classList.toggle("hidden", !ownerSelected);
      centerFields.classList.toggle("hidden", ownerSelected);
      ownerFields.disabled = !ownerSelected;
      centerFields.disabled = ownerSelected;
    }

    roleSelect.addEventListener("change", updateRoleFields);
    updateRoleFields();

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const values = new FormData(form);
      const role = roleSelect.value;
      if (!["owner", "center"].includes(role)) {
        showMessage("register-message", "Admin and Manager accounts must be created by an Admin.", false);
        return;
      }
      const email = String(values.get("email")).trim().toLowerCase();
      const password = String(values.get("password"));
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const requiredValues = role === "owner"
        ? ["ownerName", "email", "phone", "address", "ssn"]
        : ["serviceCenterName", "serviceCenterAddress", "email", "centerPhone"];
      if (requiredValues.some((name) => !String(values.get(name) || "").trim())) {
        showMessage("register-message", "Complete all required fields before creating your account.", false);
        return;
      }
      if (!emailPattern.test(email)) {
        showMessage("register-message", "Enter a valid email address.", false);
        return;
      }
      if (role === "owner" && !/^\d{3}-\d{2}-\d{4}$/.test(String(values.get("ssn")).trim())) {
        showMessage("register-message", "Enter a fake SSN in the format 123-45-6789.", false);
        return;
      }
      if (password.length < 8) {
        showMessage("register-message", "Password must be at least 8 characters.", false);
        return;
      }
      if (password !== values.get("confirmPassword")) {
        showMessage("register-message", "Passwords do not match.", false);
        return;
      }
      if (window.CarCareData.findUser(email)) {
        showMessage("register-message", "You're already registered.", false);
        document.getElementById("already-registered-link").classList.remove("hidden");
        return;
      }

      const user = {
        id: makeId(role),
        role,
        email,
        password,
        disabled: false
      };
      if (role === "owner") {
        user.name = String(values.get("ownerName")).trim();
        user.ownerName = user.name;
        user.phone = String(values.get("phone")).trim();
        user.address = String(values.get("address")).trim();
        user.ssn = String(values.get("ssn")).trim();
      } else {
        user.name = String(values.get("serviceCenterName")).trim();
        user.serviceCenterName = user.name;
        user.serviceCenterAddress = String(values.get("serviceCenterAddress")).trim();
        user.phone = String(values.get("centerPhone")).trim();
        user.serviceCenterId = makeId("center");
      }

      try {
        window.CarCareData.addUser(user);
        setSession(user);
        newlyRegisteredUser = user;
        form.classList.add("hidden");
        document.getElementById("registration-user-id").textContent = user.id;
        confirmation.classList.remove("hidden");
        if (role === "owner") {
          document.getElementById("registration-ssn").textContent = window.CarCareUI.maskSsn(user.ssn);
          firstVehiclePanel.classList.remove("hidden");
        } else {
          document.getElementById("center-registration-next").classList.remove("hidden");
        }
      } catch (error) {
        showMessage("register-message", error.message, false);
      }
    });

    document.getElementById("first-vehicle-form").addEventListener("submit", function (event) {
      event.preventDefault();
      if (!newlyRegisteredUser || newlyRegisteredUser.role !== "owner") return;
      const vehicleForm = event.currentTarget;
      if (!vehicleForm.elements.vehicleNumber.value.trim() ||
          !vehicleForm.elements.vehicleMake.value.trim() ||
          !vehicleForm.elements.carModel.value.trim()) {
        showMessage("vehicle-message", "Complete the vehicle number, make, model, and year.", false);
        return;
      }
      const year = Number(vehicleForm.elements.year.value);
      if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1) {
        showMessage("vehicle-message", "Enter a valid vehicle year.", false);
        return;
      }
      const vehicle = {
        id: makeId("vehicle"),
        ownerId: newlyRegisteredUser.id,
        vehicleNumber: vehicleForm.elements.vehicleNumber.value.trim(),
        vehicleMake: vehicleForm.elements.vehicleMake.value.trim(),
        carModel: vehicleForm.elements.carModel.value.trim(),
        year
      };
      try {
        window.CarCareData.save("vehicles", window.CarCareData.get("vehicles").concat(vehicle));
        window.location.href = routeFor(newlyRegisteredUser);
      } catch (error) {
        showMessage("vehicle-message", error.message, false);
      }
    });

    document.getElementById("skip-first-vehicle").addEventListener("click", function () {
      if (newlyRegisteredUser) window.location.href = routeFor(newlyRegisteredUser);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initLogin();
    initPasswordReset();
    initRegistration();
    document.querySelectorAll("[data-logout]").forEach((button) => button.addEventListener("click", logout));
    const portal = document.querySelector("[data-required-role]");
    if (portal) requireRole(portal.dataset.requiredRole);
  });

  window.CarCareAuth = { getSession, requireRole, logout, makeAuthenticatorCode };
}());
