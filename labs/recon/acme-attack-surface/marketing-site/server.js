const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8084;

// robots.txt trying to keep crawlers away from a path is, in practice, a
// map. Nothing links to /backup/ anywhere on the site — this is the only
// place its path appears at all.
app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send("User-agent: *\nDisallow: /backup/\nDisallow: /.git/\n");
});

// A backup file left in the public webroot after a deploy — extremely
// common in real recon findings, usually found by requesting a filename
// pattern (dated .sql/.zip/.bak dumps) rather than by being linked
// anywhere.
app.get("/backup/acme-full-2026-01.sql.bak", (req, res) => {
  res.type("text/plain").send(
    "-- Acme Corp full export, 2026-01-04\n" +
      "-- WARNING: internal use only, delete after restore testing\n\n" +
      "INSERT INTO app_config (key, value) VALUES\n" +
      "  ('api_key', 'sk_live_4cme_9f2c1b'),\n" +
      "  ('support_note', '0xBugLabs{r0b0ts_txt_1s_a_m4p_n0t_a_w4ll}');\n",
  );
});

// A .git directory shipped to production by accident — another classic,
// real recon finding. The config file alone (not even the full history)
// is often enough to learn about infrastructure that was never meant to
// be public.
app.get("/.git/config", (req, res) => {
  res.type("text/plain").send(
    "[core]\n" +
      "\trepositoryformatversion = 0\n" +
      "\tfilemode = true\n" +
      "[remote \"origin\"]\n" +
      "\turl = git@github.com:acme-corp/marketing-site.git\n" +
      "\tfetch = +refs/heads/*:refs/remotes/origin/*\n" +
      "[remote \"legacy-deploy\"]\n" +
      "\t# old deploy target, keep until the migration is confirmed done\n" +
      "\turl = ssh://deploy@localhost:8085/var/www/legacy-portal\n" +
      "[branch \"main\"]\n" +
      "\tremote = origin\n" +
      "\tmerge = refs/heads/main\n",
  );
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Acme marketing site listening on :${PORT}`);
});
