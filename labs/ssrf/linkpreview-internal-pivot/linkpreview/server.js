const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8082;

const users = [{ id: 1, username: "priya", password: bcrypt.hashSync("priya123", 10), displayName: "Priya Shah" }];

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
app.use(session({ secret: "0xbuglabs-linkpreview-dev-secret", resave: false, saveUninitialized: false }));

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

// A denylist, not an allowlist — the app's author was thinking about
// "don't let people hit our own box," not "only let this feature reach
// the public internet." That gap is the entire lab.
const BLOCKED_HOST_PATTERNS = [/^localhost$/i, /^127\./, /^0\.0\.0\.0$/, /^\[?::1\]?$/, /^169\.254\./];

function isBlockedHost(hostname) {
  return BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

app.get("/", (req, res) => res.redirect(req.session.userId ? "/preview" : "/login"));

app.get("/login", (req, res) => res.render("login", { error: null }));

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === (username || "").trim());
  if (!user || !bcrypt.compareSync(password || "", user.password)) {
    return res.render("login", { error: "Invalid username or password." });
  }
  req.session.userId = user.id;
  res.redirect("/preview");
});

app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/login")));

app.get("/preview", requireAuth, (req, res) => {
  res.render("preview", { user: users[0], result: null, error: null, url: "" });
});

// --- The vulnerable feature ------------------------------------------------
// Paste a URL, the server fetches it and shows you a snippet — a classic
// "unfurl a link" feature (same category as Slack/Discord link previews,
// where SSRF gets reported constantly in the real world). The only check
// is the denylist above; anything not on it goes straight to fetch().
app.post("/preview", requireAuth, async (req, res) => {
  const rawUrl = (req.body.url || "").trim();
  let target;

  try {
    target = new URL(rawUrl);
  } catch {
    return res.render("preview", { user: users[0], result: null, error: "That's not a valid URL.", url: rawUrl });
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    return res.render("preview", { user: users[0], result: null, error: "Only http/https URLs are supported.", url: rawUrl });
  }

  if (isBlockedHost(target.hostname)) {
    return res.render("preview", { user: users[0], result: null, error: "That host isn't allowed.", url: rawUrl });
  }

  try {
    const response = await fetch(target.toString(), { signal: AbortSignal.timeout(5000) });
    const text = await response.text();
    res.render("preview", { user: users[0], result: text.slice(0, 2000), error: null, url: rawUrl });
  } catch (err) {
    res.render("preview", { user: users[0], result: null, error: `Couldn't fetch that URL: ${err.message}`, url: rawUrl });
  }
});

// A leftover internal status page — the kind of thing that's useful during
// development and never gets removed. It doesn't expose anything sensitive
// directly, just the name of another service Acme runs internally.
app.get("/status", requireAuth, (req, res) => {
  res.render("status", { user: users[0] });
});

app.listen(PORT, () => {
  console.log(`linkpreview listening on :${PORT}`);
});
