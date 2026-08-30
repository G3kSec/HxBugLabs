const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");

const {
  workspaces,
  documents,
  findUserByEmail,
  findUserById,
  findWorkspaceById,
  findWorkspaceBySlug,
  findDocumentById,
  documentsForWorkspace,
} = require("./data/seed");

const app = express();
const PORT = process.env.PORT || 8081;

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "clearline-dev-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" },
  }),
);

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    if (req.originalUrl.startsWith("/api/")) {
      return res.status(401).json({ error: "authentication required" });
    }
    return res.redirect("/login");
  }
  next();
}

function currentUser(req) {
  return findUserById(req.session.userId);
}

/* ── Pages ─────────────────────────────────────────────────────────────── */

app.get("/", (req, res) => res.redirect(req.session.userId ? "/documents" : "/login"));

app.get("/login", (req, res) => res.render("login", { error: null }));

app.post("/login", (req, res) => {
  const user = findUserByEmail((req.body.email || "").trim());
  if (!user || !bcrypt.compareSync(req.body.password || "", user.password)) {
    return res.render("login", { error: "Those credentials didn't work." });
  }
  req.session.userId = user.id;
  res.redirect("/documents");
});

app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/login")));

app.get("/documents", requireAuth, (req, res) => {
  const user = currentUser(req);
  res.render("documents", {
    user,
    workspace: findWorkspaceById(user.workspaceId),
    documents: documentsForWorkspace(user.workspaceId),
  });
});

app.get("/documents/:id", requireAuth, (req, res) => {
  const user = currentUser(req);
  const doc = findDocumentById(req.params.id);
  if (!doc) return res.status(404).render("not-found", { user });
  res.render("document", {
    user,
    doc,
    workspace: findWorkspaceById(doc.workspaceId),
  });
});

/* ── API v2 — what the current front end calls ─────────────────────────── */

const v2 = express.Router();

/* Everything under /api/v1 is deprecated. The header is advertised on v2
   so integrators migrating off v1 can confirm they're on the new stack;
   RFC 8594 wants the sunset date machine-readable. */
v2.use((req, res, next) => {
  res.set("Deprecation", "false");
  res.set("Sunset", "Tue, 30 Jun 2026 23:59:59 GMT");
  res.set("Link", '</api/v1>; rel="predecessor-version"; title="retired 2024-11, mobile clients only"');
  next();
});

/* Full-text search across contracts. The workspace filter is applied by
   the client so the same endpoint can back the admin console's
   cross-workspace view without a second implementation. */
v2.get("/search", requireAuth, (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (q.length < 2) return res.json({ query: q, results: [] });

  const results = documents
    .filter((d) => `${d.title} ${d.counterparty} ${d.body}`.toLowerCase().includes(q))
    .map((d) => ({
      id: d.id,
      title: d.title,
      counterparty: d.counterparty,
      status: d.status,
      workspaceId: d.workspaceId,
    }));

  res.json({ query: q, count: results.length, results });
});

v2.get("/documents/:id", requireAuth, (req, res) => {
  const doc = findDocumentById(req.params.id);
  if (!doc) return res.status(404).json({ error: "not found" });
  res.json(doc);
});

app.use("/api/v2", v2);

/* ── API v1 — retired, still routed for the 3.x mobile clients ─────────── */

const v1 = express.Router();

v1.use((req, res, next) => {
  res.set("Deprecation", "Wed, 13 Nov 2024 00:00:00 GMT");
  res.set("Sunset", "Tue, 30 Jun 2026 23:59:59 GMT");
  next();
});

/* v1 authenticated with a device token in a header rather than a session
   cookie, and the workspace was taken from the path because the 3.x app
   let a user hold several. Session auth was bolted on when the token
   service was shut down; the per-workspace membership check that the
   token service used to perform went with it. */
v1.get("/workspaces/:slug/export", requireAuth, (req, res) => {
  const workspace = findWorkspaceBySlug(req.params.slug);
  if (!workspace) return res.status(404).json({ error: "unknown workspace" });

  res.json({
    apiVersion: "1.4.2",
    workspace: { id: workspace.id, slug: workspace.slug, name: workspace.name },
    exportedAt: new Date().toISOString(),
    exportToken: "HxBugLabs{sh4d0w_4p1_v1_n3v3r_g0t_th3_f1x}",
    documents: documentsForWorkspace(workspace.id),
  });
});

v1.get("/workspaces", requireAuth, (req, res) => {
  res.json({ apiVersion: "1.4.2", workspaces: workspaces.map((w) => ({ slug: w.slug, name: w.name })) });
});

app.use("/api/v1", v1);

app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "not found" });
  res.status(404).render("not-found", { user: currentUser(req) || null });
});

app.listen(PORT, () => console.log(`Clearline listening on :${PORT}`));
