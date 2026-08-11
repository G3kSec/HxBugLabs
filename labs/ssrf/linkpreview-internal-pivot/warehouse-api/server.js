const express = require("express");
const app = express();
const PORT = process.env.PORT || 9000;

// This service has no auth at all. That's not a separate bug for this
// lab — it's the standard (bad) assumption behind most real internal-SSRF
// findings: "it's only reachable from inside the network, so it doesn't
// need its own auth." SSRF is exactly what breaks that assumption.

app.get("/", (req, res) => {
  res.send(
    "Warehouse Inventory API — internal use only\n" +
      "status: operational\n" +
      "note: 0xBugLabs{ssrf_r34ch3d_th3_1nt3rn4l_n3tw0rk}\n",
  );
});

app.get("/internal/config", (req, res) => {
  res.json({
    service: "warehouse-api",
    deploy_key: "wh_live_9f2c...redacted-in-real-life",
    flag: "0xBugLabs{ssrf_p1v0t_t0_hidd3n_3ndp0int}",
    note: "This route isn't linked from anywhere — found by guessing common internal paths after reaching this service at all.",
  });
});

app.listen(PORT, () => {
  console.log(`warehouse-api listening internally on :${PORT}`);
});
