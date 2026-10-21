(function () {
  "use strict";

  const SESSION_KEY = "carcare.prototype.session.v1";
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

  function setSession(user) {
    try {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        serviceCenterId: user.serviceCenterId || null
      }));
    } catch (error) {
      console.error("Unable to save the Car Care session.", error);
      throw new Error("Your browser could not save your session.");
    }
  }

  function logout() {
    window.localStorage.removeItem(SESSION_KEY);
    window.location.href = "login.html";
  }

  function requireRole(expectedRole) {
    const session = getSession();
    if (!session || (session.role !== expectedRole && !(expectedRole === "center" && ["manager", "technician"].includes(session.role)))) {
      window.location.replace("login.html");
      return null;
    }
    const greeting = document.getElementById("user-greeting");
    if (greeting) greeting.textContent = session.name;
    return session;
  }

  function setMessage(id, message, success) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("success", Boolean(success));
  }

  function initLogin() {
    const form = document.getElementById("login-form");
    if (!form) return;
    const emailField = form.elements.email;
    const passwordField = form.elements.password;
    const mfaContainer = document.getElementById("mfa-field");
    const mfaField = form.elements.mfaCode;
    let adminCandidate = null;

    function inspectForAdmin() {
      adminCandidate = window.CarCareData.findUser(emailField.value.trim());
      const needsMfa = adminCandidate && adminCandidate.role === "admin";
      mfaContainer.classList.toggle("hidden", !needsMfa);
      mfaField.required = Boolean(needsMfa);
    }

    emailField.addEventListener("input", inspectForAdmin);
    emailField.addEventListener("change", inspectForAdmin);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const user = window.CarCareData.findUser(emailField.value.trim());
      if (!user || user.password !== passwordField.value) {
        setMessage("login-message", "Email or password is incorrect. Please try again.", false);
        return;
      }
      if (user.role === "admin" && user.mfaCode !== mfaField.value.trim()) {
        setMessage("login-message", "Enter the simulated admin verification code to continue.", false);
        mfaContainer.classList.remove("hidden");
        return;
      }
      try {
        setSession(user);
        window.location.href = routes[user.role] || "login.html";
      } catch (error) {
        setMessage("login-message", error.message, false);
      }
    });
  }

  function initRegistration() {
    const form = document.getElementById("register-form");
    if (!form) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const name = form.elements.name.value.trim();
      const email = form.elements.email.value.trim().toLowerCase();
      const password = form.elements.password.value;
      const role = form.elements.role.value;
      if (window.CarCareData.findUser(email)) {
        setMessage("register-message", "An account with this email already exists. Log in instead.", false);
        return;
      }
      const user = { id: "user-" + Date.now(), name, email, password, role };
      if (role === "center") {
        user.serviceCenterId = "center-" + user.id;
        user.serviceCenterName = name;
      }
      try {
        window.CarCareData.addUser(user);
        setSession(user);
        window.location.href = routes[role];
      } catch (error) {
        setMessage("register-message", error.message, false);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initLogin();
    initRegistration();
    document.querySelectorAll("[data-logout]").forEach((button) => button.addEventListener("click", logout));
    const portal = document.querySelector("[data-required-role]");
    if (portal) requireRole(portal.dataset.requiredRole);
  });

  window.CarCareAuth = { getSession, requireRole, logout };
}());
