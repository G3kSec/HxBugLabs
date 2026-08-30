const bcrypt = require("bcryptjs");

const users = [
  {
    id: 1,
    email: "ops@brightwell-haulage.example",
    name: "Marta Brightwell",
    company: "Brightwell Haulage",
    password: bcrypt.hashSync("Freight!2026", 10),
  },
];

/* Lanes you can book against your credit balance. The Antwerp charter is
   priced above what any account is ever funded with — it exists so the
   settlement desk can quote it, not so anyone can self-serve it. */
const lanes = [
  { code: "RTM-SNT", from: "Rotterdam", to: "Santos", credits: 120, kind: "container" },
  { code: "ANR-VAP", from: "Antwerp", to: "Valparaiso", credits: 260, kind: "container" },
  { code: "HAM-BUE", from: "Hamburg", to: "Buenos Aires", credits: 310, kind: "container" },
  { code: "CHARTER-ANR", from: "Antwerp", to: "any", credits: 5000, kind: "full-charter" },
];

const findUserByEmail = (email) =>
  users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
const findLane = (code) => lanes.find((l) => l.code === String(code).toUpperCase());

module.exports = { users, lanes, findUserByEmail, findLane };
