const crypto = require("node:crypto");
const path = require("node:path");

const bcrypt = require("bcryptjs");
const express = require("express");
const session = require("express-session");

const { sanitize } = require("./sanitize");
const { visitAsOncall } = require("./bot");
const { incidents, comments, findUser, findUserById, findIncident } = require("./data/seed");

const app = express();
const PORT = process.env.PORT || 8085;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const ONCALL_PASSWORD = process.env.ONCALL_PASSWORD || "r0t4t10n-w33k-14-oncall";

/* Rebuilt on every boot and exposed to page scripts as window.__MOSAIC_BUILD.
   The canary endpoint below only accepts the current value, so echoing it
   back proves the caller actually executed script in the page rather than
   guessing a constant out of the repo. */
const BUILD_ID = crypto.randomBytes(8).toString("hex");

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false, limit: "256kb" }));
app.use(express.json({ limit: "256kb" }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "mosaic-status-dev-secret",
    resave: false,
    saveUninitialized: false,
    // HttpOnly on purpose: document.cookie is not the way through this lab.
    cookie: { httpOnly: true, sameSite: "lax" },
  }),
);

/* Policy shipped with the 2024 hardening pass. No unsafe-inline, so an
   event handler attribute will not execute even if one gets through the
   sanitizer. */
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  next();
});

app.use(express.static(path.join(__dirname, "public")));

const collected = [];

function currentUser(req) {
  return req.session.userId ? findUserById(req.session.userId) : null;
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    if (req.originalUrl.startsWith("/api/")) return res.status(401).json({ error: "sign in first" });
    return res.redirect("/login");
  }
  next();
}

/* ── Public status pages ───────────────────────────────────────────────── */

app.get("/", (req, res) => res.render("index", { user: currentUser(req), incidents }));

app.get("/login", (req, res) => res.render("login", { error: null }));

app.post("/login", (req, res) => {
  const user = findUser(req.body.username);
  if (!user || !bcrypt.compareSync(req.body.password || "", user.password)) {
    return res.render("login", { error: "Those credentials didn't work." });
  }
  req.session.userId = user.id;
  res.redirect("/");
});

app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/")));

app.get("/incidents/:id", (req, res) => {
  const incident = findIncident(req.params.id);
  if (!incident) return res.status(404).render("not-found", { user: currentUser(req) });

  res.render("incident", {
    user: currentUser(req),
    incident,
    comments: comments.filter((c) => c.incidentId === incident.id),
    buildId: BUILD_ID,
    posted: req.query.posted === "1",
    reported: req.query.reported === "1",
  });
});

app.post("/incidents/:id/comments", requireAuth, (req, res) => {
  const incident = findIncident(req.params.id);
  if (!incident) return res.status(404).render("not-found", { user: currentUser(req) });

  const body = sanitize(req.body.body || "");
  comments.push({
    id: comments.length + 1,
    incidentId: incident.id,
    author: currentUser(req).username,
    body,
    postedAt: new Date().toISOString(),
    reported: false,
  });

  res.redirect(`/incidents/${incident.id}?posted=1`);
});

/* Pages the on-call engineer. The bot signs in with a real browser and
   opens the incident page the comment sits on. */
app.post("/incidents/:id/report", requireAuth, async (req, res) => {
  const incident = findIncident(req.params.id);
  if (!incident) return res.status(404).render("not-found", { user: currentUser(req) });

  const comment = comments.find((c) => c.id === Number(req.body.commentId));
  if (comment) comment.reported = true;

  const target = `${BASE_URL}/incidents/${incident.id}`;
  visitAsOncall(BASE_URL, target, ONCALL_PASSWORD).catch((err) =>
    console.error("on-call visit failed:", err.message),
  );

  res.redirect(`/incidents/${incident.id}?reported=1`);
});

/* ── Legacy uptime widget ──────────────────────────────────────────────
   Predates the status page rewrite. Embedded by two partner dashboards
   that cannot do CORS, so it answers as JSONP. Slated for removal once
   both partners migrate. */
app.get("/api/legacy/uptime.js", (req, res) => {
  const callback = String(req.query.callback || "mosaicUptime");
  const payload = { window: "30d", uptime: 99.982, region: "eu-west-1", incidents: incidents.length };
  res.type("application/javascript").send(`${callback}(${JSON.stringify(payload)});`);
});

/* ── Instrumentation the exercise needs ────────────────────────────────── */

app.all("/api/collect", (req, res) => {
  const payload =
    req.method === "GET"
      ? { query: req.query }
      : { body: typeof req.body === "object" ? req.body : String(req.body) };

  collected.push({
    at: new Date().toISOString(),
    method: req.method,
    userAgent: String(req.headers["user-agent"] || "").slice(0, 120),
    ...payload,
  });

  res.type("text/plain").send("ok");
});

app.get("/api/collect/log", requireAuth, (req, res) => {
  res.json({ count: collected.length, entries: collected.slice(-25) });
});

/* Answers only to the build id the running process generated, so it can
   only be satisfied by script that executed inside the page. */
app.get("/api/canary", (req, res) => {
  if (String(req.query.build || "") !== BUILD_ID) {
    return res.status(400).json({ error: "build id does not match this instance" });
  }
  res.json({
    executed: true,
    note: "script ran in the page context under the deployed CSP",
    flag: "HxBugLabs{r3s3r14l1z1ng_1s_wh3r3_s4n1t1z3rs_d13}",
  });
});

/* ── Engineer-only ─────────────────────────────────────────────────────── */

function requireEngineer(req, res, next) {
  const user = currentUser(req);
  if (!user || user.role !== "engineer") {
    return res.status(403).json({ error: "engineer role required" });
  }
  next();
}

app.get("/admin/api/rotation-key", requireEngineer, (req, res) => {
  res.json({
    rotation: "week-14",
    pagerEscalation: "+31 20 555 0148",
    statuspageWriteKey: "HxBugLabs{y0u_d0nt_n33d_th3_c00k13_y0u_h4v3_th3_br0ws3r}",
  });
});

app.get("/admin/queue", requireEngineer, (req, res) => {
  res.json({ reported: comments.filter((c) => c.reported).map((c) => ({ id: c.id, incidentId: c.incidentId })) });
});

app.use((req, res) => res.status(404).render("not-found", { user: currentUser(req) }));

app.listen(PORT, () => console.log(`Mosaic Status listening on :${PORT} (build ${BUILD_ID})`));
