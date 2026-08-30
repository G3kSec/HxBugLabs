// Shipment rows the dispatcher console exports. Two of these are the
// customers Vega's support team keeps getting called about; the rest are
// filler so the CSV looks like a real export rather than a puzzle.
const shipments = [
  { ref: "VG-88213", origin: "Rotterdam", dest: "Santos", weightKg: 18400, consignee: "Halberd Metals", status: "in-transit" },
  { ref: "VG-88214", origin: "Antwerp", dest: "Valparaiso", weightKg: 9100, consignee: "Nortek Foods", status: "customs-hold" },
  { ref: "VG-88219", origin: "Hamburg", dest: "Buenos Aires", weightKg: 22750, consignee: "Astra Chemicals", status: "in-transit" },
  { ref: "VG-88231", origin: "Felixstowe", dest: "Callao", weightKg: 3120, consignee: "Duarte Logistica", status: "delivered" },
  { ref: "VG-88240", origin: "Le Havre", dest: "Montevideo", weightKg: 15980, consignee: "Kessler Pharma", status: "in-transit" },
];

// The legacy dispatcher portal shipped its own user table as flat JSON.
// Nobody migrated it when the new portal went live — the file is still on
// disk and the old routes still read it.
const legacyUsers = [
  {
    username: "m.ferreira",
    // bcrypt of "vega2016" — the hash is period-accurate for when this
    // portal was written, which is the point.
    passwordHash: "$2a$10$5oV8Qh0kQ1s2Y4a6C8e0uOa3xJ7mN9pL2rT4vW6yZ8bD0fH2jK4mS",
    role: "dispatcher",
    lastLogin: "2016-11-04T09:12:44Z",
  },
  {
    username: "svc-edi-import",
    passwordHash: "$2a$10$9pQ2rT4vW6yZ8bD0fH2jK.uOa3xJ7mN5oV8Qh0kQ1s2Y4a6C8e0u",
    role: "service",
    lastLogin: "2019-02-20T23:58:01Z",
  },
];

module.exports = { shipments, legacyUsers };
