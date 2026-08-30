const http = require("node:http");
const https = require("node:https");
const path = require("node:path");

const bcrypt = require("bcryptjs");
const express = require("express");
const session = require("express-session");

const { users, pages, ALLOWED_HOSTS } = require("./data/seed");

const app = express();
const PORT = process.env.PORT || 8083;

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "quill-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" },
  }),
);

const webhooks = [];
const deliveries = [];

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

const currentUser = (req) => users.find((u) => u.id === req.session.userId);

/* ── Webhook destination policy ────────────────────────────────────────
   Pull the authority out of the URL, drop the userinfo, and check the
   result against the allow-list. Deliberately does not use new URL():
   the endpoints customers register are frequently missing a scheme or
   carry a trailing template placeholder, and the WHATWG parser throws on
   both, which generated a lot of support load. */
function hostFromUrl(raw) {
  const withoutScheme = String(raw).replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const authority = withoutScheme.split("/")[0].split("?")[0].split("#")[0];
  const withoutUserinfo = authority.split("@")[0];
  return withoutUserinfo.split(":")[0].toLowerCase();
}

function destinationAllowed(raw) {
  if (!/^https?:\/\//i.test(String(raw))) {
    return { ok: false, reason: "Only http:// and https:// destinations are accepted." };
  }

  const host = hostFromUrl(raw);
  if (!host) return { ok: false, reason: "Could not read a hostname from that URL." };

  const allowed =
    ALLOWED_HOSTS.includes(host) || ALLOWED_HOSTS.some((d) => host.endsWith(`.${d}`));

  if (!allowed) {
    return {
      ok: false,
      reason: `Destination "${host}" is not on the allow-list (${ALLOWED_HOSTS.join(", ")}).`,
    };
  }
  return { ok: true, host };
}

/* Fires the webhook and keeps the response so customers can debug their
   own endpoint from the delivery log. */
function deliver(hook, payload) {
  return new Promise((resolve) => {
    let target;
    try {
      target = new URL(hook.url);
    } catch {
      return resolve({ ok: false, status: 0, body: "invalid URL" });
    }

    const client = target.protocol === "https:" ? https : http;
    const headers = { "Content-Type": "application/json", "User-Agent": "Quill-Webhooks/2.4" };
    for (const [name, value] of Object.entries(hook.headers)) headers[name] = value;

    const req = client.request(
      target,
      { method: hook.method, headers, timeout: 5000 },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            ok: true,
            status: res.statusCode,
            contentType: res.headers["content-type"] || "",
            body: Buffer.concat(chunks).toString("utf8").slice(0, 4000),
          }),
        );
      },
    );

    req.on("timeout", () => { req.destroy(); resolve({ ok: false, status: 0, body: "timed out" }); });
    req.on("error", (err) => resolve({ ok: false, status: 0, body: String(err.message) }));
    req.end(hook.method === "GET" ? undefined : JSON.stringify(payload));
  });
}

/* ── Routes ────────────────────────────────────────────────────────────── */

app.get("/", (req, res) => res.redirect(req.session.userId ? "/spaces" : "/login"));

app.get("/login", (req, res) => res.render("login", { error: null }));

app.post("/login", (req, res) => {
  const user = users.find((u) => u.email.toLowerCase() === (req.body.email || "").trim().toLowerCase());
  if (!user || !bcrypt.compareSync(req.body.password || "", user.password)) {
    return res.render("login", { error: "Those credentials didn't work." });
  }
  req.session.userId = user.id;
  res.redirect("/spaces");
});

app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/login")));

app.get("/spaces", requireAuth, (req, res) => {
  res.render("spaces", { user: currentUser(req), pages });
});

app.get("/settings/webhooks", requireAuth, (req, res) => {
  res.render("webhooks", {
    user: currentUser(req),
    webhooks,
    deliveries: deliveries.slice(0, 8),
    allowed: ALLOWED_HOSTS,
    error: null,
    notice: null,
  });
});

app.post("/settings/webhooks", requireAuth, async (req, res) => {
  const url = (req.body.url || "").trim();
  const verdict = destinationAllowed(url);

  const render = (error, notice) =>
    res.render("webhooks", {
      user: currentUser(req),
      webhooks,
      deliveries: deliveries.slice(0, 8),
      allowed: ALLOWED_HOSTS,
      error,
      notice,
    });

  if (!verdict.ok) return render(verdict.reason, null);

  /* Customers whose endpoint needs authentication add their own headers.
     The value is passed through untouched — it is their credential, not
     ours to interpret. */
  const headers = {};
  const headerName = (req.body.headerName || "").trim();
  const headerValue = (req.body.headerValue || "").trim();
  if (headerName && /^[A-Za-z0-9-]+$/.test(headerName)) headers[headerName] = headerValue;

  /* Not every endpoint customers integrate with speaks POST — several
     partner platforms expect a GET with the payload in the query string,
     so the method is theirs to pick. */
  const method = String(req.body.method || "POST").toUpperCase() === "GET" ? "GET" : "POST";

  const hook = {
    id: webhooks.length + 1,
    url,
    method,
    headers,
    event: "page.updated",
    createdAt: new Date().toISOString(),
  };
  webhooks.push(hook);

  const result = await deliver(hook, {
    event: "page.updated",
    page: { id: "onboarding", title: "Engineering onboarding" },
    space: currentUser(req).space,
    deliveredAt: new Date().toISOString(),
  });

  deliveries.unshift({ hookId: hook.id, url: hook.url, at: new Date().toISOString(), ...result });
  return render(null, `Webhook saved. Test delivery returned ${result.status || "no response"}.`);
});

app.post("/settings/webhooks/:id/test", requireAuth, async (req, res) => {
  const hook = webhooks.find((h) => h.id === Number(req.params.id));
  if (!hook) return res.redirect("/settings/webhooks");

  const result = await deliver(hook, { event: "ping", deliveredAt: new Date().toISOString() });
  deliveries.unshift({ hookId: hook.id, url: hook.url, at: new Date().toISOString(), ...result });
  res.redirect("/settings/webhooks");
});

app.listen(PORT, () => console.log(`Quill listening on :${PORT}`));
