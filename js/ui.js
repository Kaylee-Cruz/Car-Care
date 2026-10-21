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

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-toast]").forEach((element) => element.addEventListener("click", () => toast(element.dataset.toast)));
  });

  window.CarCareUI = { formatDate, toast, escapeHtml };
}());
