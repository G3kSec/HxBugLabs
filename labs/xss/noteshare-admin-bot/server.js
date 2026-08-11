const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");

const {
  users,
  notes,
  collectedCookies,
  ADMIN_PASSWORD,
  findUserByUsername,
  findUserById,
  findNoteById,
  notesForUser,
  createNote,
  recordCapturedCookie,
} = require("./data/seed");
const { visitAsAdmin } = require("./bot");

const app = express();
const PORT = process.env.PORT || 8081;
const BASE_URL = `http://localhost:${PORT}`;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "0xbuglabs-noteshare-dev-secret",
    resave: false,
    saveUninitialized: false,
    // httpOnly is deliberately false — a real, properly-built app would
    // set this to true. Leaving the session cookie readable from JS is
    // exactly the bug that makes objective 2's cookie theft possible.
    // Real apps have shipped this exact misconfiguration.
    cookie: { httpOnly: false },
  }),
);

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

function requireAdmin(req, res, next) {
  const user = findUserById(req.session.userId);
  if (!user || user.role !== "admin") {
    return res.status(403).send("Forbidden — admin only.");
  }
  next();
}

app.get("/", (req, res) => res.redirect(req.session.userId ? "/notes" : "/login"));

app.get("/login", (req, res) => res.render("login", { error: null }));

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = findUserByUsername((username || "").trim());
  if (!user || !bcrypt.compareSync(password || "", user.password)) {
    return res.render("login", { error: "Invalid username or password." });
  }
  req.session.userId = user.id;
  res.redirect(user.role === "admin" ? "/admin/dashboard" : "/notes");
});

app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/login")));

app.get("/notes", requireAuth, (req, res) => {
  const user = findUserById(req.session.userId);
  res.render("notes", { user, notes: notesForUser(user.id), solvedReflected: !!req.session.solvedReflected });
});

app.get("/notes/new", requireAuth, (req, res) => {
  res.render("new-note", { user: findUserById(req.session.userId), error: null });
});

app.post("/notes/new", requireAuth, (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) {
    return res.render("new-note", { user: findUserById(req.session.userId), error: "Title and body are both required." });
  }
  const note = createNote(req.session.userId, title.trim(), body);
  res.redirect(`/notes/${note.id}`);
});

// --- Stored XSS lives here -----------------------------------------------
// note.body is rendered with EJS's <%- %> (unescaped) in views/note.ejs.
// Any note is viewable by URL regardless of owner — public support notes,
// by design for this lab, so the admin bot can be pointed at one.
app.get("/notes/:id", requireAuth, (req, res) => {
  const note = findNoteById(Number(req.params.id));
  if (!note) return res.status(404).send("Note not found.");
  res.render("note", { user: findUserById(req.session.userId), note });
});

// --- Objective 1: reflected XSS -------------------------------------------
// q is reflected unescaped into the results heading.
app.get("/search", requireAuth, (req, res) => {
  const q = req.query.q || "";
  res.render("search", { user: findUserById(req.session.userId), query: q });
});

// Called by a script running in the victim's own browser after a
// successful reflected-XSS execution. Deliberately simple: whoever's
// session is calling this is the session that gets credit, which only
// makes sense because for objective 1 that's always the real player —
// nobody else ever loads /search on your behalf.
app.post("/api/solve/reflected-xss", requireAuth, (req, res) => {
  req.session.solvedReflected = true;
  res.json({ solved: true, flag: "0xBugLabs{r3fl3ct3d_xss_r34l_ex3cut10n}" });
});

// --- Objective 2: report-to-admin, steal the session -----------------------
app.get("/report", requireAuth, (req, res) => {
  res.render("report", { user: findUserById(req.session.userId), result: null, error: null });
});

app.post("/report", requireAuth, async (req, res) => {
  const { url } = req.body;
  const user = findUserById(req.session.userId);

  if (!url || !url.startsWith(BASE_URL)) {
    return res.render("report", { user, result: null, error: "Only URLs on this app can be reported." });
  }

  try {
    await visitAsAdmin(BASE_URL, url, ADMIN_PASSWORD);
    res.render("report", { user, result: "The support team reviewed your report.", error: null });
  } catch (err) {
    res.render("report", { user, result: null, error: `The bot couldn't load that page: ${err.message}` });
  }
});

// Called from within the admin's browser session (via the bot) by an
// exfiltration payload — not authenticated as the player, on purpose:
// this is the attacker-controlled collection endpoint that a stored XSS
// payload calls, so it has to be reachable without the player's session.
app.get("/api/collect", (req, res) => {
  const cookie = req.query.c || "";
  if (cookie) recordCapturedCookie(req.get("referer") || "unknown", cookie);
  res.status(204).end();
});

app.get("/my-reports", requireAuth, (req, res) => {
  res.render("my-reports", { user: findUserById(req.session.userId), captures: collectedCookies });
});

app.get("/admin/dashboard", requireAuth, requireAdmin, (req, res) => {
  res.render("admin-dashboard", {
    user: findUserById(req.session.userId),
    flag: "0xBugLabs{st0l3n_s3ss10n_c00k13_4cc0unt_t4k30v3r}",
  });
});

app.listen(PORT, () => {
  console.log(`NoteShare lab listening on :${PORT}`);
});
