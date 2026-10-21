(function () {
  "use strict";

  function formatDate(value) {
    const date = new Date(value + "T12:00:00");
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
  }

  function toast(message, type) {
    let region = document.querySelector(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-atomic", "false");
      document.body.appendChild(region);
    }
    const item = document.createElement("div");
    item.className = "toast" + (type ? " " + type : "");
    item.textContent = message;
    region.appendChild(item);
    window.setTimeout(() => item.remove(), 3600);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[character]));
  }

  function maskSsn(value) {
    const digits = String(value).replace(/\D/g, "");
    return digits.length === 9 ? "***-**-" + digits.slice(-4) : "***-**-****";
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-toast]").forEach((element) => element.addEventListener("click", () => toast(element.dataset.toast)));

    const seenMessages = new WeakMap();
    const messageSelector = ".form-message, .admin-form-message, [data-estimate-message], [data-shipment-message]";
    const observer = new MutationObserver(() => {
      document.querySelectorAll(messageSelector).forEach((element) => {
        if (!element.isConnected || element.closest(".hidden, [hidden]")) return;
        const message = element.textContent.trim();
        if (!message) {
          seenMessages.set(element, "");
          return;
        }
        if (seenMessages.get(element) === message) return;
        seenMessages.set(element, message);
        const isError = element.classList.contains("is-error") ||
          /error|could not|cannot|invalid|already exists|required|choose|select|enter a valid|failed|must be|not found|not available|does not/i.test(message);
        toast(message, isError ? "error" : "success");
      });
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });

    document.querySelectorAll("[data-reset-demo]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!window.confirm("Reset all Car Care demo data to the original seed?")) return;
        try {
          window.CarCareData.resetDemoData();
          window.localStorage.removeItem("carcare.prototype.session.v1");
          window.location.href = "index.html";
        } catch (error) {
          console.error("Unable to reset Car Care demo data.", error);
          toast(error.message, "error");
        }
      });
    });
  });

  window.CarCareUI = { formatDate, toast, escapeHtml, maskSsn };
}());
