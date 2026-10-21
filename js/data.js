(function () {
  "use strict";

  const STORAGE_KEY = "carcare.prototype.data.v2";
  const COLLECTIONS = [
    "users", "vehicles", "parts", "serviceRequests", "serviceHistory",
    "notifications", "inventory", "shipments", "vehicleModels", "payments", "reports"
  ];

  function dateOffset(days) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  }

  function createSeed() {
    const users = [
      { id: "owner-1", name: "Alex Morgan", ownerName: "Alex Morgan", email: "owner@carcare.demo", password: "demo123", role: "owner", ssn: "123-45-6789" },
      { id: "owner-2", name: "Taylor Brooks", ownerName: "Taylor Brooks", email: "owner2@carcare.demo", password: "demo123", role: "owner", ssn: "987-65-4321" },
      { id: "center-manager-1", name: "Sam Rivera", email: "manager@carcare.demo", password: "demo123", role: "manager", serviceCenterId: "center-1", serviceCenterName: "Greenline Auto Care", serviceCenterAddress: "1840 Cedar Avenue" },
      { id: "center-tech-1", name: "Casey Nguyen", email: "technician@carcare.demo", password: "demo123", role: "technician", serviceCenterId: "center-1", serviceCenterName: "Greenline Auto Care", serviceCenterAddress: "1840 Cedar Avenue" },
      { id: "center-manager-2", name: "Morgan Patel", email: "center2@carcare.demo", password: "demo123", role: "manager", serviceCenterId: "center-2", serviceCenterName: "Northside Motor Works", serviceCenterAddress: "72 North Market Street" },
      { id: "admin-1", name: "Jordan Lee", email: "admin@carcare.demo", password: "demo123", role: "admin", mfaCode: "246810" }
    ];

    const vehicles = [
      { id: "vehicle-1", ownerId: "owner-1", vehicleNumber: "CC-4821", vehicleMake: "Honda", carModel: "Civic", year: 2022, assignedCenterId: "center-1" },
      { id: "vehicle-2", ownerId: "owner-2", vehicleNumber: "CC-7316", vehicleMake: "Toyota", carModel: "Corolla", year: 2021, assignedCenterId: "center-2" }
    ];

    const partData = [
      ["vehicle-1", "Brakes", -480, 65],
      ["vehicle-1", "Engine oil", -75, 15],
      ["vehicle-1", "Battery", -480, 250],
      ["vehicle-1", "Tires", -740, -20],
      ["vehicle-1", "Air filter", -170, 7],
      ["vehicle-1", "Timing belt", -680, 420],
      ["vehicle-2", "Brakes", -850, -10],
      ["vehicle-2", "Engine oil", -270, 90],
      ["vehicle-2", "Battery", -520, 12],
      ["vehicle-2", "Tires", -560, 210],
      ["vehicle-2", "Air filter", -400, -35],
      ["vehicle-2", "Timing belt", -510, 900]
    ];
    const parts = partData.map((entry, index) => ({
      id: "part-" + (index + 1),
      vehicleId: entry[0],
      partName: entry[1],
      installDate: dateOffset(entry[2]),
      expiryDate: dateOffset(entry[3])
    }));

    const vehicleModels = [
      ["Honda", "Civic", 2022], ["Honda", "Accord", 2023], ["Honda", "CR-V", 2024],
      ["Toyota", "Corolla", 2021], ["Toyota", "Camry", 2024], ["Toyota", "RAV4", 2023],
      ["Ford", "Escape", 2022], ["Ford", "F-150", 2024], ["Ford", "Explorer", 2023],
      ["Hyundai", "Elantra", 2023], ["Hyundai", "Tucson", 2024], ["Hyundai", "Santa Fe", 2022],
      ["Subaru", "Outback", 2023], ["Nissan", "Altima", 2022], ["Mazda", "CX-5", 2024]
    ].map((entry, index) => ({ id: "model-" + (index + 1), make: entry[0], model: entry[1], year: entry[2] }));

    const inventory = [
      { id: "inventory-1", serviceCenterId: "center-1", partName: "Engine oil (5W-30)", sku: "OIL-5W30", quantity: 18, reorderLevel: 8, unitPrice: 34.99 },
      { id: "inventory-2", serviceCenterId: "center-1", partName: "Brake pad set", sku: "BRK-HON-CV", quantity: 4, reorderLevel: 5, unitPrice: 89.5 },
      { id: "inventory-3", serviceCenterId: "center-1", partName: "Cabin air filter", sku: "FLT-CAB-01", quantity: 7, reorderLevel: 4, unitPrice: 21.99 },
      { id: "inventory-4", serviceCenterId: "center-1", partName: "Car battery", sku: "BAT-12V-60", quantity: 3, reorderLevel: 4, unitPrice: 159.99 },
      { id: "inventory-5", serviceCenterId: "center-2", partName: "Engine oil (5W-30)", sku: "OIL-5W30", quantity: 12, reorderLevel: 8, unitPrice: 34.99 },
      { id: "inventory-6", serviceCenterId: "center-2", partName: "All-season tire", sku: "TIRE-AS-16", quantity: 8, reorderLevel: 6, unitPrice: 124.5 },
      { id: "inventory-7", serviceCenterId: "center-2", partName: "Engine air filter", sku: "FLT-ENG-02", quantity: 2, reorderLevel: 5, unitPrice: 26.5 },
      { id: "inventory-8", serviceCenterId: "center-2", partName: "Timing belt kit", sku: "BLT-TM-04", quantity: 3, reorderLevel: 2, unitPrice: 215 }
    ];

    const serviceHistory = [
      { id: "service-1", ownerId: "owner-1", vehicleId: "vehicle-1", serviceCenterId: "center-1", serviceCenterName: "Greenline Auto Care", technician: "Casey Nguyen", date: dateOffset(-68), partsChanged: ["Engine oil", "Air filter"], cost: 89.5, serviceCompleted: true },
      { id: "service-2", ownerId: "owner-1", vehicleId: "vehicle-1", serviceCenterId: "center-1", serviceCenterName: "Greenline Auto Care", technician: "Sam Rivera", date: dateOffset(-145), partsChanged: ["Brakes"], cost: 245, serviceCompleted: true },
      { id: "service-3", ownerId: "owner-2", vehicleId: "vehicle-2", serviceCenterId: "center-2", serviceCenterName: "Northside Motor Works", technician: "Morgan Patel", date: dateOffset(-32), partsChanged: ["Engine oil", "Tires"], cost: 389.99, serviceCompleted: true }
    ];

    const notifications = [
      { id: "notification-1", recipientId: "owner-1", type: "service-reminder", message: "Your air filter is due for service soon.", createdAt: dateOffset(0), read: false },
      { id: "notification-2", recipientId: "owner-1", type: "service-reminder", message: "Your tires are past their estimated service date.", createdAt: dateOffset(0), read: false },
      { id: "notification-3", recipientId: "owner-2", type: "service-reminder", message: "Your brakes are past their estimated service date.", createdAt: dateOffset(0), read: false },
      { id: "notification-4", recipientId: "center-manager-1", type: "center-reminder", message: "Alex Morgan's Honda Civic has parts needing attention.", createdAt: dateOffset(0), read: false },
      { id: "notification-5", recipientId: "center-manager-2", type: "center-reminder", message: "Taylor Brooks's Toyota Corolla has parts needing attention.", createdAt: dateOffset(0), read: false }
    ];

    return {
      users,
      vehicles,
      parts,
      serviceRequests: [
        { id: "request-1", ownerId: "owner-1", vehicleId: "vehicle-1", serviceCenterId: "center-1", status: "inspection-pending", createdAt: dateOffset(-2), orderNumber: "CC-2026-1042" }
      ],
      serviceHistory,
      notifications,
      inventory,
      shipments: [
        { id: "shipment-1", serviceCenterId: "center-1", item: "Brake pad set", quantity: 6, status: "In transit", expectedDate: dateOffset(3) },
        { id: "shipment-2", serviceCenterId: "center-2", item: "Engine air filter", quantity: 10, status: "Scheduled", expectedDate: dateOffset(8) }
      ],
      vehicleModels,
      payments: [
        { id: "payment-1", providerId: "demo-psp", transactionId: "TXN-DEMO-1001", serviceHistoryId: "service-1", amount: 89.5, paymentSuccessful: true, method: "UPI", date: dateOffset(-68) },
        { id: "payment-2", providerId: "demo-psp", transactionId: "TXN-DEMO-1002", serviceHistoryId: "service-3", amount: 389.99, paymentSuccessful: true, method: "Card", date: dateOffset(-32) }
      ],
      reports: []
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isValidStore(data) {
    return data && COLLECTIONS.every((collection) => Array.isArray(data[collection]));
  }

  function writeStore(data) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Unable to save Car Care demo data.", error);
      throw new Error("Your browser could not save this change. Check local storage availability.");
    }
  }

  function loadStore() {
    let stored;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      console.error("Unable to access Car Care demo data.", error);
      throw new Error("Car Care needs browser local storage enabled to run this prototype.");
    }
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (isValidStore(data)) return data;
      } catch (error) {
        console.warn("Stored Car Care data is invalid; restoring demo data.", error);
      }
    }
    const initialData = createSeed();
    writeStore(initialData);
    return initialData;
  }

  let state = loadStore();

  function save(collection, value) {
    if (!COLLECTIONS.includes(collection)) {
      throw new Error("Unknown Car Care data collection: " + collection);
    }
    if (!Array.isArray(value)) {
      throw new TypeError("Car Care collection values must be arrays.");
    }
    const nextState = Object.assign({}, state, { [collection]: clone(value) });
    writeStore(nextState);
    state = nextState;
  }

  function resetDemoData() {
    const initialData = createSeed();
    writeStore(initialData);
    state = initialData;
    return getAll();
  }

  function getAll() {
    return clone(state);
  }

  window.CarCareData = {
    collections: COLLECTIONS.slice(),
    get(collection) {
      if (!COLLECTIONS.includes(collection)) {
        throw new Error("Unknown Car Care data collection: " + collection);
      }
      return clone(state[collection]);
    },
    save,
    getAll,
    resetDemoData,
    findUser(email) {
      return state.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
    },
    addUser(user) {
      if (state.users.some((existingUser) => existingUser.email.toLowerCase() === user.email.toLowerCase())) {
        throw new Error("An account with this email already exists.");
      }
      save("users", state.users.concat(clone(user)));
    }
  };
}());
