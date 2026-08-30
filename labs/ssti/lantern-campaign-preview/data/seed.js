const bcrypt = require("bcryptjs");

const hash = (plain) => bcrypt.hashSync(plain, 10);

const users = [
  {
    id: 1,
    email: "marketing@brightwell.example",
    name: "Sofia Brightwell",
    password: hash("Lantern-Campaigns-2026"),
    role: "author",
  },
];

/* Workspace-level settings. Passed into the preview context because the
   footer template needs the sender address and the unsubscribe host; the
   rest of the object came along with it. */
const workspace = {
  id: "WS-BRIGHTWELL",
  name: "Brightwell Haulage",
  plan: "Growth",
  senderAddress: "hello@brightwell.example",
  unsubscribeHost: "unsub.lantern-mail.example",
  deliveryRegion: "eu-west-1",
  internalNotes: "Dedicated IP pool since 2025-11.",
  webhookSigningKey: "whsec_HxBugLabs{th3_c0nt3xt_1s_wh4t3v3r_y0u_p4ss3d_1t}",
};

const sampleRecipient = {
  firstName: "Marta",
  lastName: "Duarte",
  email: "marta.duarte@example.com",
  company: "Duarte Logistica",
  segment: "reactivation-q1",
};

const campaigns = [
  {
    id: "CMP-2026-02-REACTIVATION",
    name: "Q1 reactivation",
    subject: "{{ recipient.firstName }}, your Brightwell rates for Q1",
    body:
      "<p>Hi {{ recipient.firstName }},</p>\n" +
      "<p>Your Q1 rate card for {{ recipient.company }} is ready.</p>\n" +
      "<p>&mdash; {{ workspace.name }}</p>",
  },
  {
    id: "CMP-2026-02-NEWSLETTER",
    name: "February newsletter",
    subject: "Lane capacity update — February",
    body: "<p>Hello {{ recipient.firstName }},</p>\n<p>Here is what changed on your lanes this month.</p>",
  },
];

const findUserByEmail = (email) =>
  users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
const findUserById = (id) => users.find((u) => u.id === id);

module.exports = { users, workspace, campaigns, sampleRecipient, findUserByEmail, findUserById };
