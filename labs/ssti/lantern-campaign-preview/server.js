const path = require("node:path");

const bcrypt = require("bcryptjs");
const express = require("express");
const session = require("express-session");
const nunjucks = require("nunjucks");

const { users, workspace, campaigns, sampleRecipient, findUserByEmail, findUserById } = require("./data/seed");

const app = express();
const PORT = process.env.PORT || 8092;

app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "lantern-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" },
  }),
);
app.use(express.static(path.join(__dirname, "public")));

/* Campaign bodies are Nunjucks templates. autoescape is on so a merge tag
   carrying a recipient's name cannot inject markup into the mail we send. */
const templates = new nunjucks.Environment(null, { autoescape: true });

/**
 * Preview safety net, added after an incident review. Campaign bodies are
 * author-supplied and compiled in-process, so the obvious escape routes
 * are refused outright before anything is rendered.
 */
const BLOCKED_TOKENS = [
  "constructor",
  "process",
  "require",
  "global",
  "child_process",
  "mainModule",
  "__proto__",
  "eval",
  "Function",
];

function screenTemplate(source) {
  const lowered = String(source).toLowerCase();
  const hit = BLOCKED_TOKENS.find((token) => lowered.includes(token.toLowerCase()));
  return hit ? { ok: false, token: hit } : { ok: true };
}

function currentUser(req) {
  return req.session.userId ? findUserById(req.session.userId) : null;
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "sign in first" });
  next();
}

/* ── Auth ──────────────────────────────────────────────────────────────── */

app.post("/api/session", (req, res) => {
  const user = findUserByEmail(req.body.email);
  if (!user || !bcrypt.compareSync(req.body.password || "", user.password)) {
    return res.status(401).json({ error: "invalid credentials" });
  }
  req.session.userId = user.id;
  res.json({ ok: true, email: user.email, role: user.role });
});

app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));

/* ── Campaigns ─────────────────────────────────────────────────────────── */

app.get("/api/campaigns", requireAuth, (req, res) => {
  res.json({ campaigns: campaigns.map((c) => ({ id: c.id, name: c.name, subject: c.subject, body: c.body })) });
});

app.put("/api/campaigns/:id", requireAuth, (req, res) => {
  const campaign = campaigns.find((c) => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: "no such campaign" });

  if (typeof req.body.body === "string") campaign.body = req.body.body;
  if (typeof req.body.subject === "string") campaign.subject = req.body.subject;

  res.json({ ok: true, campaign: { id: campaign.id, subject: campaign.subject, body: campaign.body } });
});

/**
 * Renders a campaign body against a sample recipient so the author can
 * see what lands in an inbox. The context carries everything a merge tag
 * might reasonably want: the recipient, the campaign, and the workspace
 * the campaign belongs to.
 */
app.post("/api/campaigns/:id/preview", requireAuth, (req, res) => {
  const campaign = campaigns.find((c) => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: "no such campaign" });

  const source = typeof req.body.body === "string" ? req.body.body : campaign.body;

  const screening = screenTemplate(source);
  if (!screening.ok) {
    return res.status(400).json({
      error: `template contains a blocked token: "${screening.token}"`,
      blocked: BLOCKED_TOKENS,
    });
  }

  const context = {
    recipient: sampleRecipient,
    campaign,
    workspace,
    user: { name: currentUser(req).name, email: currentUser(req).email },
    now: new Date().toISOString(),
  };

  try {
    res.json({ campaign: campaign.id, rendered: templates.renderString(source, context) });
  } catch (error) {
    res.status(400).json({ error: "render failed", detail: String(error.message).split("\n")[0] });
  }
});

app.listen(PORT, () => console.log(`Lantern listening on :${PORT}`));
