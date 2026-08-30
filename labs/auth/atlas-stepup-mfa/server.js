const crypto = require("crypto");
const path = require("path");

const bcrypt = require("bcryptjs");
const express = require("express");
const session = require("express-session");

const { users, mailbox, payrollRuns, findUserByEmail, findUserById } = require("./data/seed");

const app = express();
const PORT = process.env.PORT || 8082;

/* Codes are four digits because they are read off a phone screen and
   typed by hand; support pushed back hard on six. */
const CODE_LENGTH = 4;
const MAX_ATTEMPTS = 5;

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "atlas-payroll-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" },
  }),
);

/* Live sign-in codes, keyed by user id. A resend appends rather than
   replaces so a delayed mail does not lock someone out of the code they
   are already typing. */
const codeStore = new Map();

function issueCode(userId) {
  const code = String(crypto.randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
  const entry = codeStore.get(userId) || { codes: [], attempts: 0 };
  entry.codes.push(code);
  entry.attempts = 0;
  codeStore.set(userId, entry);

  const user = findUserById(userId);
  if (user && user.id === 11) {
    mailbox.unshift({
      from: "no-reply@atlas.example",
      subject: "Your Atlas sign-in code",
      receivedAt: new Date().toISOString(),
      body: `Your sign-in code is ${code}. It is valid for this sign-in attempt.`,
    });
  }
  return code;
}

function pendingUser(req) {
  return req.session.pendingUserId ? findUserById(req.session.pendingUserId) : null;
}

function currentUser(req) {
  return req.session.userId ? findUserById(req.session.userId) : null;
}

function requireSession(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

function requireAdmin(req, res, next) {
  const user = currentUser(req);
  if (!user || user.role !== "admin") return res.status(403).render("denied", { user });
  next();
}

/* ── Sign-in ───────────────────────────────────────────────────────────── */

app.get("/", (req, res) => res.redirect(req.session.userId ? "/dashboard" : "/login"));

app.get("/login", (req, res) => res.render("login", { error: null, email: "" }));

/* The two failure messages are deliberate: the helpdesk asked for them so
   staff stop raising tickets about typing the wrong address. */
app.post("/login", (req, res) => {
  const email = (req.body.email || "").trim();
  const user = findUserByEmail(email);

  if (!user) {
    return res.render("login", { error: "No Atlas account uses that address.", email });
  }
  if (!bcrypt.compareSync(req.body.password || "", user.password)) {
    return res.render("login", { error: "That password is not correct for this account.", email });
  }

  req.session.userId = null;
  req.session.pendingUserId = user.id;
  issueCode(user.id);
  res.redirect("/mfa");
});

app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/login")));

app.get("/mfa", (req, res) => {
  if (!req.session.pendingUserId) return res.redirect("/login");
  res.render("mfa", { error: null });
});

/* Renders the "signing in as…" banner on the code screen so people who
   keep two Atlas accounts open do not approve the wrong one. Reads from
   the pending session, which by definition has not passed MFA yet. */
app.get("/api/session/pending", (req, res) => {
  const user = pendingUser(req);
  if (!user) return res.status(401).json({ error: "no sign-in in progress" });
  res.json({ stage: "awaiting-code", codeLength: CODE_LENGTH, user });
});

app.post("/mfa/resend", (req, res) => {
  const user = pendingUser(req);
  if (!user) return res.status(401).json({ error: "no sign-in in progress" });

  issueCode(user.id);
  res.json({ sent: true, to: user.email.replace(/^(.).*(@.*)$/, "$1***$2") });
});

app.post("/mfa/verify", (req, res) => {
  const user = pendingUser(req);
  if (!user) return res.redirect("/login");

  const entry = codeStore.get(user.id) || { codes: [], attempts: 0 };
  if (entry.attempts >= MAX_ATTEMPTS) {
    return res.status(429).render("mfa", { error: "Too many attempts. Request a new code." });
  }

  const supplied = String(req.body.code || "").trim();
  entry.attempts += 1;
  codeStore.set(user.id, entry);

  if (!entry.codes.includes(supplied)) {
    return res.status(401).render("mfa", {
      error: `That code is not right. ${MAX_ATTEMPTS - entry.attempts} attempt(s) left.`,
    });
  }

  codeStore.delete(user.id);
  req.session.pendingUserId = null;
  req.session.userId = user.id;
  res.redirect("/dashboard");
});

/* ── Application ───────────────────────────────────────────────────────── */

app.get("/dashboard", requireSession, (req, res) => {
  res.render("dashboard", { user: currentUser(req) });
});

app.get("/directory", requireSession, (req, res) => {
  res.render("directory", {
    user: currentUser(req),
    people: users.map((u) => ({ name: u.name, email: u.email, title: u.title, department: u.department })),
  });
});

/* Juliette's corporate webmail, already signed in — the lab ships her
   client, not the mail server, so it only ever shows her inbox. */
app.get("/mailbox", (req, res) => {
  res.render("mailbox", { user: currentUser(req), messages: mailbox.slice(0, 12) });
});

app.get("/help/first-sign-in", (req, res) => {
  res.render("help", { user: currentUser(req) });
});

app.get("/admin/payroll-runs", requireSession, requireAdmin, (req, res) => {
  res.render("payroll-runs", {
    user: currentUser(req),
    runs: payrollRuns,
    approvalToken: "HxBugLabs{r3s3nd_st4ck3d_th3_k3ysp4c3_1n_y0ur_f4v0ur}",
  });
});

app.listen(PORT, () => console.log(`Atlas Payroll listening on :${PORT}`));
