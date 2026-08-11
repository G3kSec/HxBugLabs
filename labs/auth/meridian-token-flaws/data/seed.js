const bcrypt = require("bcryptjs");
const crypto = require("crypto");

function hash(plain) {
  return bcrypt.hashSync(plain, 10);
}

const users = [
  { id: 1, username: "alice", password: hash("alice123"), role: "customer", displayName: "Alice Nguyen", balance: 4210.55 },
  {
    id: 2,
    username: "bob",
    password: hash("bob-" + crypto.randomBytes(8).toString("hex")),
    role: "customer",
    displayName: "Bob Torres",
    balance: 18320.0,
    notes: "Wire verification code for the branch: 0xBugLabs{pr3d1ct4bl3_r3s3t_t0k3n_4cc0unt_t4k30v3r}",
  },
  { id: 3, username: "admin", password: hash("admin-" + crypto.randomBytes(8).toString("hex")), role: "admin", displayName: "Ops Admin", balance: 0 },
];

function findUserByUsername(username) {
  return users.find((u) => u.username === username);
}

function findUserById(id) {
  return users.find((u) => u.id === id);
}

module.exports = { users, findUserByUsername, findUserById };
