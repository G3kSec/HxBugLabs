/**
 * Internal artifact store. Sits on the private network, so the only
 * control it was given is "present a role token issued by IMDS". No
 * check of which principal presents it, no audience binding, no mTLS.
 */
const express = require("express");

const app = express();
const PORT = process.env.PORT || 80;
const ROLE_TOKEN = "FwoGZXIvYXdzEBYaDJ-quill-dispatcher-session-token-v3";

app.disable("x-powered-by");

function requireRoleToken(req, res, next) {
  const auth = String(req.headers.authorization || "");
  if (auth !== `Bearer ${ROLE_TOKEN}`) {
    return res.status(401).json({ error: "role token required" });
  }
  next();
}

app.get("/", (req, res) =>
  res.json({ service: "artifacts.internal", hint: "GET /buckets, GET /buckets/:name" }),
);

app.get("/buckets", requireRoleToken, (req, res) => {
  res.json({ buckets: ["quill-page-exports", "quill-db-snapshots", "quill-deploy-keys"] });
});

app.get("/buckets/quill-deploy-keys", requireRoleToken, (req, res) => {
  res.json({
    bucket: "quill-deploy-keys",
    objects: [
      { key: "ci/github-deploy.pem", size: 1704, modified: "2026-01-30T04:11:22Z" },
      { key: "ci/rotation-token.txt", size: 46, modified: "2026-02-09T22:08:41Z",
        preview: "HxBugLabs{ssrf_1s_0nly_4s_g00d_4s_th3_p1v0t}" },
    ],
  });
});

app.get("/buckets/:name", requireRoleToken, (req, res) => {
  res.json({ bucket: req.params.name, objects: [] });
});

app.use((req, res) => res.status(404).json({ error: "not found" }));

app.listen(PORT, () => console.log(`artifacts listening on :${PORT}`));
