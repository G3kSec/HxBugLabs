const express = require("express");
const app = express();
const PORT = process.env.PORT || 8085;

// Nothing on the marketing site links here. Nothing announces this port
// is in use. The only way to this page is finding the reference to it
// (in this lab, the .git/config remote) and actually trying it — the
// entire point of an asset-discovery objective is that reaching this page
// at all *is* the finding, not something to exploit further once you're
// here.
app.get("/", (req, res) => {
  res.type("text/html").send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Acme Legacy Portal</title></head>
<body style="font-family: ui-monospace, monospace; background:#111; color:#8fda9a; padding: 3rem;">
  <h1>Acme Legacy Portal — v0.9.2</h1>
  <p>This system was scheduled for decommission in 2024. It's still here.</p>
  <p>0xBugLabs{f0rg0tt3n_4ss3t_st1ll_r34ch4bl3}</p>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`Acme legacy portal listening on :${PORT}`);
});
