const bcrypt = require("bcryptjs");

const hash = (plain) => bcrypt.hashSync(plain, 10);

/* Atlas issues temporary passwords from a template documented in the help
   centre. Two accounts here are still on theirs — the joiner process
   emails the credential and asks the employee to change it "within 14
   days", which is enforced by nothing. */
const users = [
  {
    id: 11,
    email: "j.moreau@atlas.example",
    name: "Juliette Moreau",
    password: hash("Payroll#2024"),
    role: "analyst",
    title: "Payroll Analyst",
    department: "Finance Operations",
    employeeNumber: "ATL-1188",
    startedOn: "2021-03-08",
    temporaryPassword: false,
  },
  {
    id: 12,
    email: "n.varga@atlas.example",
    name: "Nadia Varga",
    password: hash("Atlas2025!"),
    role: "admin",
    title: "Payroll Administrator",
    department: "Finance Operations",
    employeeNumber: "ATL-1402",
    startedOn: "2025-06-02",
    temporaryPassword: true,
    // Internal HR annotation, surfaced by the pending-session endpoint that
    // renders the "signing in as…" banner.
    hrNote: "Approver for EU payroll runs. Onboarding token HxBugLabs{h4lf_4uth3nt1c4t3d_1s_4uth3nt1c4t3d}",
  },
  {
    id: 13,
    email: "p.lindqvist@atlas.example",
    name: "Petra Lindqvist",
    password: hash("W1nterSolstice!77"),
    role: "analyst",
    title: "Benefits Analyst",
    department: "People",
    employeeNumber: "ATL-0994",
    startedOn: "2019-09-16",
    temporaryPassword: false,
  },
];

/* Only Juliette's mailbox is modelled — the lab ships the webmail client
   she is already signed in to, not the whole mail server. */
const mailbox = [
  {
    from: "people-ops@atlas.example",
    subject: "Reminder: quarter-end payroll freeze",
    receivedAt: "2026-02-11T08:41:00Z",
    body: "The February run locks on the 22nd. Submit adjustments before 17:00 CET.",
  },
  {
    from: "it-helpdesk@atlas.example",
    subject: "Your Atlas sign-in has changed",
    receivedAt: "2026-01-06T12:02:00Z",
    body:
      "From January, Atlas mails you a numeric code on every sign-in. Codes are four digits " +
      "and stay valid for the length of your sign-in attempt. If a code does not arrive, use " +
      "the resend link on the code screen as many times as you need.",
  },
];

const payrollRuns = [
  { id: "RUN-2026-02-EU", period: "2026-02", headcount: 412, gross: "EUR 3,118,440", state: "awaiting-approval" },
  { id: "RUN-2026-01-EU", period: "2026-01", headcount: 409, gross: "EUR 3,072,910", state: "paid" },
  { id: "RUN-2026-01-UK", period: "2026-01", headcount: 88, gross: "GBP 611,205", state: "paid" },
];

const findUserByEmail = (email) => users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
const findUserById = (id) => users.find((u) => u.id === id);

module.exports = { users, mailbox, payrollRuns, findUserByEmail, findUserById };
