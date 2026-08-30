const bcrypt = require("bcryptjs");

const hash = (plain) => bcrypt.hashSync(plain, 10);

const users = [
  {
    id: 1,
    workspaceId: "WS-NORTHGATE",
    email: "analyst@northgate.example",
    password: hash("Kestrel-Reports-2026"),
    role: "analyst",
  },
];

/* Permission sets by role. A context issued for a service token carries
   its grants inline instead; that path is why isAllowed() checks
   ctx.grants first. */
const ROLE_GRANTS = {
  viewer: ["reports:read"],
  analyst: ["reports:read"],
  finance: ["reports:read", "reports:render", "exports:read"],
  admin: ["reports:read", "reports:render", "exports:read", "workspace:manage"],
};

const reports = [
  {
    id: "RPT-2026-02-REVENUE",
    title: "Revenue by product line",
    period: "2026-02",
    rows: 1841,
    generatedAt: "2026-02-14T03:12:00Z",
  },
  {
    id: "RPT-2026-02-CHURN",
    title: "Churn cohort analysis",
    period: "2026-02",
    rows: 612,
    generatedAt: "2026-02-14T03:14:00Z",
  },
];

const findUserByEmail = (email) =>
  users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
const findUserById = (id) => users.find((u) => u.id === id);

module.exports = { users, reports, ROLE_GRANTS, findUserByEmail, findUserById };
