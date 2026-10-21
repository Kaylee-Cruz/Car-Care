(function () {
  "use strict";

  const STORAGE_KEY = "carcare.prototype.data.v1";
  const seed = {
    users: [
      { id: "owner-1", name: "Alex Morgan", email: "owner@carcare.demo", password: "demo123", role: "owner" },
      { id: "center-1", name: "Greenline Auto Care", email: "center@carcare.demo", password: "demo123", role: "center" },
      { id: "admin-1", name: "Jordan Lee", email: "admin@carcare.demo", password: "demo123", role: "admin", mfaCode: "246810" }
    ],
    vehicles: [
      {
        ownerId: "owner-1", vehicleNumber: "••• 4821", vehicleMake: "Honda", carModel: "Civic", year: 2022,
        parts: [
          { name: "Engine oil", status: "Upcoming", expiryDate: "2026-11-08" },
          { name: "Brake pads", status: "Good", expiryDate: "2027-03-14" },
          { name: "Cabin air filter", status: "Due soon", expiryDate: "2026-10-30" },
          { name: "Battery", status: "Good", expiryDate: "2027-08-02" }
        ]
      }
    ],
    serviceHistory: [
      { ownerId: "owner-1", date: "2026-08-14", center: "Greenline Auto Care", technician: "Sam Rivera", parts: ["Engine oil", "Oil filter"], cost: 89.5 },
      { ownerId: "owner-1", date: "2026-03-02", center: "Greenline Auto Care", technician: "Sam Rivera", parts: ["Brake inspection"], cost: 45 }
    ],
    centerReminders: [
      { owner: "Alex Morgan", vehicle: "2022 Honda Civic", part: "Cabin air filter", status: "Due soon" },
      { owner: "Taylor Brooks", vehicle: "2021 Toyota Corolla", part: "Engine oil", status: "Upcoming" },
      { owner: "Jamie Park", vehicle: "2023 Ford Escape", part: "Brake pads", status: "Due" }
    ],
    inventory: [
      { name: "Engine oil (5W-30)", stock: 18, unit: "units" },
      { name: "Cabin air filter", stock: 7, unit: "units" },
      { name: "Brake pad set", stock: 4, unit: "sets" }
    ],
    shipments: [
      { item: "Brake pad set", quantity: 6, status: "In transit", date: "2026-10-24" },
      { item: "Cabin air filter", quantity: 10, status: "Scheduled", date: "2026-10-29" }
    ],
    vehicleModels: ["Honda Civic", "Toyota Corolla", "Ford Escape", "Hyundai Elantra"],
    reports: []
  };

  function readStore() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        return structuredClone(seed);
      }
      const data = JSON.parse(stored);
      if (!data || !Array.isArray(data.users) || !Array.isArray(data.vehicles)) {
        throw new Error("Stored Car Care data has an invalid structure.");
      }
      return data;
    } catch (error) {
      console.error("Unable to load Car Care demo data.", error);
      return structuredClone(seed);
    }
  }

  let state = readStore();

  function save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Unable to save Car Care demo data.", error);
      throw new Error("Your browser could not save this change. Check local storage availability.");
    }
  }

  window.CarCareData = {
    get users() { return state.users; },
    get vehicles() { return state.vehicles; },
    get serviceHistory() { return state.serviceHistory; },
    get centerReminders() { return state.centerReminders; },
    get inventory() { return state.inventory; },
    get shipments() { return state.shipments; },
    get vehicleModels() { return state.vehicleModels; },
    get reports() { return state.reports; },
    findUser(email) { return state.users.find((user) => user.email.toLowerCase() === email.toLowerCase()); },
    addUser(user) {
      state.users.push(user);
      save();
    }
  };
}());
