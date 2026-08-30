const express = require("express");
const path = require("path");

const { shipments, legacyUsers } = require("./data/seed");

const app = express();
const PORT = process.env.PORT || 8080;

app.disable("x-powered-by");

/* Hostnames this process answers for. The tracking portal is the default
   site; anything else falls through to whatever matched below. Kept in
   one place after the 2021 migration so ops only has to edit one file. */
const PORTAL_HOST = "vega-freight.local";
const LEGACY_HOST = "legacy.vega-freight.local";

function hostOf(req) {
  return String(req.headers.host || "").split(":")[0].toLowerCase();
}

/* ── Legacy dispatcher portal (pre-2021) ───────────────────────────────
   Decommissioned in name only: the DNS record was dropped, the Nginx
   upstream was not. Mounted first so it wins for its own Host value. */
const legacy = express.Router();

legacy.get("/", (req, res) => {
  res.type("html").send(`<!doctype html>
<title>Vega Dispatch (legacy)</title>
<style>body{font:14px/1.5 monospace;margin:3rem auto;max-width:44rem;color:#222}</style>
<h1>Vega Dispatch</h1>
<p>Internal dispatcher console. Build 3.8.11 &mdash; deprecated, scheduled for
removal 2021-Q4.</p>
<ul>
  <li><a href="/dispatch/queue">Queue</a></li>
  <li><a href="/dispatch/users.json">User directory (JSON)</a></li>
</ul>`);
});

legacy.get("/dispatch/queue", (req, res) => {
  res.json({ build: "3.8.11", queued: shipments.filter((s) => s.status !== "delivered").length });
});

/* The old portal predates the SSO rollout: it gates on a cookie the login
   page used to set, and treats any value as good enough. New portal never
   sets this cookie, so in practice nobody hits this route any more. */
legacy.get("/dispatch/users.json", (req, res) => {
  res.json({
    build: "3.8.11",
    note: "flat-file auth, migrate before EOL",
    users: legacyUsers,
    supportContact: "HxBugLabs{vh0st_fuzz1ng_f1nds_d34d_d3pl0ym3nts}",
  });
});

app.use((req, res, next) => {
  if (hostOf(req) === LEGACY_HOST) return legacy(req, res, next);
  next();
});

/* ── Public tracking portal ────────────────────────────────────────────── */

app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(["User-agent: *", "Disallow: /api/", "Disallow: /assets/"].join("\n") + "\n");
});

app.get("/.well-known/security.txt", (req, res) => {
  res.type("text/plain").send(
    [
      "Contact: mailto:security@vega-freight.example",
      "Preferred-Languages: en, nl",
      "Canonical: https://vega-freight.local/.well-known/security.txt",
      "# Scope covers vega-freight.local and api.vega-freight.local only.",
      "# legacy.vega-freight.local is out of scope, it is being decommissioned.",
    ].join("\n") + "\n",
  );
});

/* ── Tracking API used by the public page ───────────────────────────── */

app.get("/api/v2/track/:ref", (req, res) => {
  const found = shipments.find((s) => s.ref.toLowerCase() === String(req.params.ref).toLowerCase());
  if (!found) return res.status(404).json({ error: "unknown reference" });
  res.json({ ref: found.ref, origin: found.origin, dest: found.dest, status: found.status });
});

/* Dispatcher-only bulk export. The console sends X-Vega-Role on every
   call; anything without it is treated as a crawler and gets the same 404
   the tracking endpoint gives for a bad reference, so the route doesn't
   show up in scans. */
app.get("/api/v2/shipments/export", (req, res) => {
  if (String(req.headers["x-vega-role"] || "").toLowerCase() !== "dispatcher") {
    return res.status(404).json({ error: "unknown reference" });
  }

  const rows = [
    "ref,origin,dest,weight_kg,consignee,status",
    ...shipments.map((s) => [s.ref, s.origin, s.dest, s.weightKg, s.consignee, s.status].join(",")),
    "# export-token,HxBugLabs{s0urc3m4p_l34ks_th3_r34l_4p1}",
  ];
  res.type("text/csv").send(rows.join("\n") + "\n");
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Vega Freight portal listening on :${PORT} (default host ${PORTAL_HOST})`);
});
