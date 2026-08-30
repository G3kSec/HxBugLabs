const http = require("node:http");
const path = require("node:path");

const bcrypt = require("bcryptjs");
const express = require("express");
const session = require("express-session");

const { findUserByEmail, findUserById } = require("./data/seed");

const app = express();
const PORT = process.env.PORT || 8080;
const EDGE_URL = new URL(process.env.EDGE_URL || "http://127.0.0.1:8087");
const AGENT_PASSWORD = process.env.AGENT_PASSWORD || "s3rv1c3-d3sk-r0t4t10n-11";
const CANONICAL_HOST = process.env.CANONICAL_HOST || "portal.harbor.example";

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "harbor-origin-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" },
  }),
);
app.use(express.static(path.join(__dirname, "public")));

const incidents = [];

/* Harbor resells the portal under partner domains. When the edge tells
   us which brand host a request arrived on, asset URLs are made absolute
   against it so a white-label domain does not pull assets from the
   canonical one; otherwise they stay relative. */
function assetOrigin(req) {
  const forwarded = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
  if (!forwarded) return "";

  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  return `${proto}://${forwarded}`;
}

/* Routes accept a format suffix: /account/profile.json returns the same
   view as JSON, /account/profile.csv as CSV. Anything we do not
   recognise renders the normal page. */
const FORMATS = { json: "json", csv: "csv" };

function splitFormat(segment) {
  const dot = String(segment).lastIndexOf(".");
  if (dot <= 0) return { name: segment, format: "html" };
  const extension = segment.slice(dot + 1).toLowerCase();
  return { name: segment.slice(0, dot), format: FORMATS[extension] || "html" };
}

function currentUser(req) {
  return req.session.userId ? findUserById(req.session.userId) : null;
}

/* ── Portal ────────────────────────────────────────────────────────────── */

app.get("/", (req, res) => {
  res.render("portal", { user: currentUser(req), assetOrigin: assetOrigin(req) });
});

app.get("/login", (req, res) =>
  res.render("login", { error: null, assetOrigin: assetOrigin(req) }),
);

app.post("/login", (req, res) => {
  const user = findUserByEmail(req.body.email);
  if (!user || !bcrypt.compareSync(req.body.password || "", user.password)) {
    return res.render("login", { error: "Those credentials didn't work.", assetOrigin: assetOrigin(req) });
  }
  req.session.userId = user.id;
  res.redirect("/account/profile");
});

app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/")));

app.get("/account/:section", (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect("/login");

  const { name, format } = splitFormat(req.params.section);
  if (name !== "profile" && name !== "billing") {
    return res.status(404).render("not-found", { assetOrigin: assetOrigin(req) });
  }

  const payload = {
    name: user.name,
    email: user.email,
    role: user.role,
    plan: user.plan,
    apiToken: user.apiToken,
  };

  if (format === "json") return res.json(payload);
  if (format === "csv") {
    return res
      .type("text/csv")
      .send(`name,email,role,plan,api_token\n${Object.values(payload).join(",")}\n`);
  }

  res.render("account", { user, section: name, assetOrigin: assetOrigin(req) });
});

/* ── Support queue ─────────────────────────────────────────────────────
   Customers paste a portal URL they are having trouble with; the desk
   opens it while signed in so they see what the customer sees. The visit
   goes through the edge, same as any browser. */
app.post("/support/queue", async (req, res) => {
  const requested = String(req.body.url || "").trim();
  if (!requested.startsWith("/")) {
    return res.status(400).json({ error: "give a path on this portal, e.g. /account/profile" });
  }

  visitAsAgent(requested).catch((error) => console.error("agent visit failed:", error.message));
  res.json({ queued: true, url: requested, note: "an agent will open this shortly" });
});

function edgeRequest(pathAndQuery, { cookie, headers } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: EDGE_URL.hostname,
        port: EDGE_URL.port || 80,
        path: pathAndQuery,
        method: "GET",
        headers: { Host: CANONICAL_HOST, ...(cookie ? { Cookie: cookie } : {}), ...(headers || {}) },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    request.on("error", reject);
    request.end();
  });
}

async function visitAsAgent(target) {
  const login = await new Promise((resolve, reject) => {
    const body = `email=${encodeURIComponent("agent.reyes@harbor.example")}&password=${encodeURIComponent(AGENT_PASSWORD)}`;
    const request = http.request(
      {
        hostname: EDGE_URL.hostname,
        port: EDGE_URL.port || 80,
        path: "/login",
        method: "POST",
        headers: {
          Host: CANONICAL_HOST,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => resolve(response.headers["set-cookie"] || []),
    );
    request.on("error", reject);
    request.end(body);
  });

  const cookie = login.map((c) => c.split(";")[0]).join("; ");
  await edgeRequest(target, { cookie });
}

/* ── Integrity monitor ─────────────────────────────────────────────────
   Fetches the portal through the edge every few seconds, exactly the way
   an ordinary visitor would, and records anything that would load code
   from a host that is not ours. */
async function monitorPortal() {
  try {
    const response = await edgeRequest("/");
    const scripts = [...response.body.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    /* The portal's own markup only ever emits relative asset URLs. An
       absolute one means something upstream rewrote the page. */
    const foreign = scripts.filter((src) => /^https?:\/\//i.test(src));

    if (foreign.length) {
      const already = incidents.some((i) => i.scripts.join() === foreign.join());
      if (!already) {
        incidents.push({
          at: new Date().toISOString(),
          servedFrom: response.headers["x-harbor-cache"] || "unknown",
          scripts: foreign,
          finding: "portal served a script from a host outside the canonical domain",
          incidentToken: "HxBugLabs{unk3y3d_h34d3r_1n_4_sh4r3d_r3sp0ns3}",
        });
      }
    }
  } catch {
    /* edge not up yet — the monitor retries on the next tick */
  }
}

setInterval(monitorPortal, 4000);

app.get("/api/incidents", (req, res) => {
  res.json({ monitoredEvery: "4s", canonicalHost: CANONICAL_HOST, incidents });
});

app.use((req, res) => res.status(404).render("not-found", { assetOrigin: assetOrigin(req) }));

app.listen(PORT, () => console.log(`Harbor origin listening on :${PORT}`));
