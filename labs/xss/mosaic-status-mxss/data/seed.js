const bcrypt = require("bcryptjs");

const hash = (plain) => bcrypt.hashSync(plain, 10);

const users = [
  {
    id: 1,
    username: "kellan",
    name: "Kellan Ashworth",
    password: hash("mosaic-status-2026"),
    role: "customer",
    org: "Brightwell Haulage",
  },
  {
    // The on-call engineer the "report to on-call" button pages. The bot
    // signs in as this account with a real browser.
    id: 2,
    username: "oncall",
    name: "Ines Duarte",
    password: hash(process.env.ONCALL_PASSWORD || "r0t4t10n-w33k-14-oncall"),
    role: "engineer",
    org: "Mosaic",
  },
];

const incidents = [
  {
    id: "INC-4471",
    title: "Elevated settlement latency in eu-west-1",
    state: "monitoring",
    opened: "2026-02-14T06:22:00Z",
    summary:
      "Settlement callbacks are queuing behind a slow downstream. Payments are not lost; " +
      "delivery of the settled webhook is delayed by up to 40 minutes.",
    updates: [
      { at: "2026-02-14T06:22:00Z", text: "Investigating elevated latency on the settlement queue." },
      { at: "2026-02-14T07:05:00Z", text: "Root cause identified, mitigation rolling out." },
      { at: "2026-02-14T08:41:00Z", text: "Backlog draining. Monitoring." },
    ],
  },
  {
    id: "INC-4468",
    title: "Card tokenisation errors for a subset of merchants",
    state: "resolved",
    opened: "2026-02-09T14:03:00Z",
    summary: "A config push rejected tokenisation requests carrying a legacy scheme identifier.",
    updates: [{ at: "2026-02-09T15:11:00Z", text: "Config rolled back. Resolved." }],
  },
];

/* Comments live in memory and reset with the container. Seeded with one
   real-looking comment so the rendering path is obvious before you touch
   it. */
const comments = [
  {
    id: 1,
    incidentId: "INC-4471",
    author: "kellan",
    body: "<p>Seeing this on our side too &mdash; <b>about 25 minutes</b> of delay on settled webhooks.</p>",
    postedAt: "2026-02-14T07:44:00Z",
    reported: false,
  },
];

const findUser = (username) =>
  users.find((u) => u.username.toLowerCase() === String(username).trim().toLowerCase());
const findUserById = (id) => users.find((u) => u.id === id);
const findIncident = (id) => incidents.find((i) => i.id === String(id).toUpperCase());

module.exports = { users, incidents, comments, findUser, findUserById, findIncident };
