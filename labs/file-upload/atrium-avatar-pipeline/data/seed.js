const bcrypt = require("bcryptjs");

const hash = (plain) => bcrypt.hashSync(plain, 10);

const staff = [
  {
    id: 1,
    name: "Nils Aaberg",
    email: "n.aaberg@atrium.example",
    password: hash("Atrium-Directory-2026"),
    title: "Platform engineer",
    team: "Infrastructure",
    avatar: null,
  },
  { id: 2, name: "Hanne Vermeulen", email: "h.vermeulen@atrium.example", password: hash("unused-in-lab"), title: "Head of people", team: "People", avatar: null },
  { id: 3, name: "Ravi Shanbhag", email: "r.shanbhag@atrium.example", password: hash("unused-in-lab"), title: "Finance analyst", team: "Finance", avatar: null },
];

const findByEmail = (email) =>
  staff.find((s) => s.email.toLowerCase() === String(email).trim().toLowerCase());
const findById = (id) => staff.find((s) => s.id === id);

module.exports = { staff, findByEmail, findById };
