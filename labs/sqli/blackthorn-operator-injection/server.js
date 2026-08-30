const path = require("node:path");

const bcrypt = require("bcryptjs");
const express = require("express");
const session = require("express-session");

const { createCollection } = require("./store");
const { recruiters, candidates } = require("./data/seed");

const app = express();
const PORT = process.env.PORT || 8090;

app.disable("x-powered-by");
app.use(express.json({ limit: "128kb" }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "blackthorn-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" },
  }),
);
app.use(express.static(path.join(__dirname, "public")));

const Recruiters = createCollection(recruiters);
const Candidates = createCollection(candidates);

/* Fields the candidate search is allowed to return. Compensation and the
   internal scorecard are deliberately not in here — recruiters filter on
   them, but the values stay inside the pipeline. */
const CANDIDATE_PROJECTION = ["id", "name", "headline", "location", "stage", "skills"];

function project(document) {
  const output = {};
  for (const field of CANDIDATE_PROJECTION) output[field] = document[field];
  return output;
}

function currentRecruiter(req) {
  return req.session.recruiterId ? Recruiters.findOne({ id: req.session.recruiterId }) : null;
}

function requireAuth(req, res, next) {
  if (!currentRecruiter(req)) return res.status(401).json({ error: "sign in first" });
  next();
}

/* ── Sign in ───────────────────────────────────────────────────────────
   Hardened after the 2025 pentest: both fields are coerced to strings
   before they reach the query, so an object in the body can never become
   an operator. */

app.post("/api/session", (req, res) => {
  const email = String((req.body && req.body.email) || "");
  const password = String((req.body && req.body.password) || "");

  const recruiter = Recruiters.findOne({ email: email.toLowerCase() });
  if (!recruiter || !bcrypt.compareSync(password, recruiter.password)) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  req.session.recruiterId = recruiter.id;
  res.json({ ok: true, email: recruiter.email, role: recruiter.role });
});

app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get("/api/me", requireAuth, (req, res) => {
  const me = currentRecruiter(req);
  res.json({ id: me.id, name: me.name, email: me.email, role: me.role });
});

/* ── Password reset ────────────────────────────────────────────────────
   A recruiter who has lost access gets a one-time token by email and
   presents it here with the address it was sent to. */

app.post("/api/password-reset/request", (req, res) => {
  const email = String((req.body && req.body.email) || "").toLowerCase();
  const recruiter = Recruiters.findOne({ email });

  /* Always the same answer, so the endpoint cannot be used to tell which
     addresses have accounts. */
  res.json({ ok: true, message: "if that address has an account, a reset token is on its way" });
  if (recruiter) console.log(`[reset] token re-sent to ${recruiter.email}`);
});

app.post("/api/password-reset/verify", (req, res) => {
  const { email, token, newPassword } = req.body || {};
  if (!email || token === undefined) {
    return res.status(400).json({ error: "email and token are required" });
  }

  const recruiter = Recruiters.findOne({
    email: String(email).toLowerCase(),
    resetToken: token,
  });

  if (!recruiter) return res.status(401).json({ error: "that token is not valid for this account" });

  if (typeof newPassword === "string" && newPassword.length >= 8) {
    recruiter.password = bcrypt.hashSync(newPassword, 10);
  }

  req.session.recruiterId = recruiter.id;

  res.json({
    ok: true,
    signedInAs: { id: recruiter.id, email: recruiter.email, role: recruiter.role },
    ...(recruiter.role === "head-of-talent"
      ? { adminNote: "HxBugLabs{4n_0p3r4t0r_1s_n0t_4_str1ng}" }
      : {}),
  });
});

/* ── Candidate search ──────────────────────────────────────────────────
   The saved-search UI builds a filter object client-side and posts it, so
   recruiters can combine conditions the API never had to anticipate. */

app.post("/api/candidates/search", requireAuth, (req, res) => {
  const filter = req.body && typeof req.body.filter === "object" && req.body.filter !== null
    ? req.body.filter
    : {};

  let results;
  try {
    results = Candidates.find(filter);
  } catch (error) {
    return res.status(400).json({ error: "could not evaluate that filter" });
  }

  res.json({
    count: results.length,
    fields: CANDIDATE_PROJECTION,
    results: results.map(project),
  });
});

app.get("/api/candidates/:id", requireAuth, (req, res) => {
  const candidate = Candidates.findOne({ id: req.params.id });
  if (!candidate) return res.status(404).json({ error: "no such candidate" });
  res.json(project(candidate));
});

app.listen(PORT, () => console.log(`Blackthorn ATS listening on :${PORT}`));
