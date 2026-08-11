const bcrypt = require("bcryptjs");

// In-memory store — this is a single-session training lab, not a real
// deployment, so there's no reason to add a real database dependency.
// From the attacker's side of an HTTP request this is indistinguishable
// from Postgres or SQLite; it just doesn't need a volume to reset cleanly
// every time the container restarts.

const users = [
  { id: 1, username: "alice", password: hash("alice123"), role: "customer", displayName: "Alice Nguyen" },
  { id: 2, username: "bob", password: hash("bob123"), role: "customer", displayName: "Bob Torres" },
  { id: 3, username: "carol", password: hash("carol123"), role: "customer", displayName: "Carol Whitfield" },
];

const tickets = [
  {
    id: 1,
    ownerId: 1,
    subject: "Invoice PDF won't download",
    body: "The download button on invoice #4471 just spins and never finishes. Tried on Chrome and Firefox. Any known issue?",
    status: "open",
  },
  {
    id: 2,
    ownerId: 1,
    subject: "How do I change my billing email?",
    body: "I moved companies and need to update the email invoices go to. Couldn't find the setting anywhere in the dashboard.",
    status: "answered",
  },
  {
    id: 3,
    ownerId: 2,
    subject: "Can't reset my password",
    body: "Hi team, I'm locked out of my account after the platform migration last week. My backup verification code from the old system is 0xBugLabs{h0riz0nt4l_1d0r_1s_st1ll_a_bug} — let me know if you need anything else to confirm it's me.",
    status: "open",
  },
  {
    id: 4,
    ownerId: 3,
    subject: "Feature request: dark mode",
    body: "Not urgent, just curious if dark mode is on the roadmap. Staring at the white dashboard at 11pm is rough.",
    status: "open",
  },
];

// Only reachable through /agent/dashboard — a normal customer should
// never see this list. That's the entire point of objective 2.
const internalNotes = [
  {
    id: 1,
    subject: "[INTERNAL] Legacy admin panel decommission checklist",
    body: "Reminder for the on-call agent: the old admin panel at /legacy-admin is still reachable internally. Temp bypass token for this week's audit is 0xBugLabs{v3rt1c4l_4cc3ss_c0ntr0l_m1ss1ng} — rotate this and disable the route before Friday's review.",
    author: "sarah.agent",
  },
];

function hash(plain) {
  return bcrypt.hashSync(plain, 10);
}

function findUserByUsername(username) {
  return users.find((u) => u.username === username);
}

function findUserById(id) {
  return users.find((u) => u.id === id);
}

function findTicketById(id) {
  return tickets.find((t) => t.id === id);
}

function ticketsForUser(userId) {
  return tickets.filter((t) => t.ownerId === userId);
}

module.exports = {
  users,
  tickets,
  internalNotes,
  findUserByUsername,
  findUserById,
  findTicketById,
  ticketsForUser,
};
