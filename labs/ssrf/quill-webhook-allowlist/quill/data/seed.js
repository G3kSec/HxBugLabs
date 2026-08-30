const bcrypt = require("bcryptjs");

const users = [
  {
    id: 1,
    email: "tobias@lumenworks.example",
    name: "Tobias Reinholt",
    password: bcrypt.hashSync("Quill-Docs-2026", 10),
    space: "Lumenworks Engineering",
  },
];

const pages = [
  { id: "onboarding", title: "Engineering onboarding", updated: "2026-02-10" },
  { id: "runbook-db", title: "Database runbook", updated: "2026-02-12" },
  { id: "oncall", title: "On-call rotation", updated: "2026-02-13" },
];

/* Domains a customer may point a webhook at. Partner integrations run on
   subdomains of hooks.quill.io; a handful of vendors are pinned by name. */
const ALLOWED_HOSTS = ["hooks.quill.io", "webhooks.slack.com", "events.pagerduty.com"];

module.exports = { users, pages, ALLOWED_HOSTS };
