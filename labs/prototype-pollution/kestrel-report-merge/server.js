const { execFile } = require("node:child_process");
const path = require("node:path");

const bcrypt = require("bcryptjs");
const express = require("express");
const session = require("express-session");

const { users, reports, ROLE_GRANTS, findUserByEmail, findUserById } = require("./data/seed");

const app = express();
const PORT = process.env.PORT || 8088;

app.disable("x-powered-by");
app.use(express.json({ limit: "128kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "kestrel-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" },
  }),
);
app.use(express.static(path.join(__dirname, "public")));

/* Per-user preference documents. Nested on purpose — the UI stores
   layout, formatting and notification settings under their own keys. */
const preferences = new Map();

function defaultPreferences() {
  return {
    theme: "light",
    density: "comfortable",
    layout: { sidebar: "expanded", columns: 3 },
    numbers: { locale: "en-GB", decimals: 2 },
    notifications: { digest: "weekly", channels: ["email"] },
  };
}

/**
 * Recursive merge used by the preferences endpoint. Objects are merged
 * key by key so a partial update does not wipe the branch it lands in;
 * anything that is not a plain object replaces the value outright.
 */
function merge(target, source) {
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== "object") target[key] = {};
      merge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

/* ── Request context and authorization ─────────────────────────────────
   Every handler works from a context object rather than the raw request,
   so a permission check never has to know about Express. */
function buildContext(req) {
  const user = req.session.userId ? findUserById(req.session.userId) : null;
  if (!user) return null;

  return {
    userId: user.id,
    email: user.email,
    workspaceId: user.workspaceId,
    requestId: Math.random().toString(36).slice(2, 10),
  };
}

/**
 * A context can carry its own grants (service tokens do this), otherwise
 * the grants are looked up from the role the context was issued with.
 */
function isAllowed(ctx, permission) {
  const grants = ctx.grants || ROLE_GRANTS[ctx.role] || ROLE_GRANTS.viewer;
  return Array.isArray(grants) && grants.includes(permission);
}

function requireSession(req, res, next) {
  const ctx = buildContext(req);
  if (!ctx) return res.status(401).json({ error: "sign in first" });
  req.ctx = ctx;
  next();
}

/* ── Auth ──────────────────────────────────────────────────────────────── */

app.post("/api/session", (req, res) => {
  const user = findUserByEmail(req.body.email);
  if (!user || !bcrypt.compareSync(req.body.password || "", user.password)) {
    return res.status(401).json({ error: "invalid credentials" });
  }
  req.session.userId = user.id;
  if (!preferences.has(user.id)) preferences.set(user.id, defaultPreferences());
  res.json({ ok: true, email: user.email, role: user.role });
});

app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));

/* ── Preferences ───────────────────────────────────────────────────────── */

app.get("/api/preferences", requireSession, (req, res) => {
  res.json(preferences.get(req.ctx.userId) || defaultPreferences());
});

app.patch("/api/preferences", requireSession, (req, res) => {
  const current = preferences.get(req.ctx.userId) || defaultPreferences();
  const updated = merge(current, req.body || {});
  preferences.set(req.ctx.userId, updated);
  res.json(updated);
});

/* ── Reports ───────────────────────────────────────────────────────────── */

app.get("/api/reports", requireSession, (req, res) => {
  res.json({ reports: reports.map((r) => ({ id: r.id, title: r.title, period: r.period })) });
});

/* Exports carry every row rather than the summary, so they need their own
   grant. Finance and workspace admins have it; analysts do not. */
app.get("/api/exports", requireSession, (req, res) => {
  if (!isAllowed(req.ctx, "exports:read")) {
    return res.status(403).json({ error: "your context has no exports:read grant" });
  }

  res.json({
    exports: reports.map((r) => ({ id: r.id, rows: r.rows, generatedAt: r.generatedAt })),
    note: "full-fidelity export, finance only",
    exportToken: "HxBugLabs{4_m1ss1ng_pr0p3rty_1s_4n_4tt4ck_surf4c3}",
  });
});

const RENDER_DEFAULTS = {
  engine: "/usr/bin/env",
  baseArgs: ["echo"],
  timeoutMs: 5000,
};

/**
 * Renders a report by handing it to the workspace's render engine. A
 * report can override the engine and both argument lists — several
 * workspaces run their own build of the PDF toolchain and it does not
 * take the same flags as ours.
 */
app.post("/api/reports/:id/render", requireSession, (req, res) => {
  if (!isAllowed(req.ctx, "reports:render")) {
    return res.status(403).json({ error: "your context has no reports:render grant" });
  }

  const report = reports.find((r) => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: "no such report" });

  const options = report.render || {};
  const engine = options.engine || RENDER_DEFAULTS.engine;
  const baseArgs = options.baseArgs || RENDER_DEFAULTS.baseArgs;
  const extraArgs = options.extraArgs || [];
  const argv = [...baseArgs, ...extraArgs, report.id];

  execFile(engine, argv, { timeout: RENDER_DEFAULTS.timeoutMs }, (error, stdout, stderr) => {
    res.json({
      report: report.id,
      engine,
      argv,
      exitCode: error ? error.code ?? 1 : 0,
      stdout: String(stdout).slice(0, 4000),
      stderr: String(stderr).slice(0, 2000),
    });
  });
});

app.listen(PORT, () => console.log(`Kestrel Reports listening on :${PORT}`));
