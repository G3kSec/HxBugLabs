const bcrypt = require("bcryptjs");

const hash = (plain) => bcrypt.hashSync(plain, 10);

const users = [
  {
    id: 1,
    email: "you@tenant.example",
    name: "Your account",
    password: hash("harbor-portal-2026"),
    role: "customer",
    plan: "Team",
    apiToken: "hb_live_customer_2f81c4",
  },
  {
    /* The support agent whose session fills the cache. You never get
       these credentials — the queue below visits URLs on their behalf. */
    id: 2,
    email: "agent.reyes@harbor.example",
    name: "Delia Reyes",
    password: hash(process.env.AGENT_PASSWORD || "s3rv1c3-d3sk-r0t4t10n-11"),
    role: "support",
    plan: "Internal",
    apiToken: "hb_live_support_HxBugLabs{th3_3dg3_c4ch3d_wh4t_th3_0r1g1n_p3rs0n4l1z3d}",
  },
];

const findUserByEmail = (email) =>
  users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
const findUserById = (id) => users.find((u) => u.id === id);

module.exports = { users, findUserByEmail, findUserById };
