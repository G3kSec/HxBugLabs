const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const path = require("path");
const crypto = require("crypto");

const { users, findUserByUsername, findUserById } = require("./data/seed");
const jwt = require("./jwt");

const app = express();
const PORT = process.env.PORT || 8083;

// Real secret, never sent to the client — the point of objective 2 is that
// forging a valid session shouldn't require knowing this at all.
const JWT_SECRET = crypto.randomBytes(32).toString("hex");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

function currentUser(req) {
  const token = req.cookies.token;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return findUserById(payload.userId) || null;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.redirect("/login");
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).send("Forbidden — admin only.");
  }
  next();
}

// --- Reset tokens ---------------------------------------------------------
// Meant to look random (base64), isn't: username plus the current hour,
// nothing else. Decode any token you're issued and the pattern is right
// there in plaintext. "Encoded" and "unpredictable" are not the same
// property, and this app's author treated them as if they were.
function generateResetToken(username) {
  const hourBucket = Math.floor(Date.now() / 3600000);
  return Buffer.from(`${username}:${hourBucket}`).toString("base64");
}

function resolveResetToken(token) {
  try {
    const [username, hourBucketStr] = Buffer.from(token, "base64").toString("utf8").split(":");
    const hourBucket = Number(hourBucketStr);
    const currentHourBucket = Math.floor(Date.now() / 3600000);
    // One hour of grace, same as plenty of real reset-token implementations.
    if (hourBucket !== currentHourBucket && hourBucket !== currentHourBucket - 1) return null;
    return findUserByUsername(username) || null;
  } catch {
    return null;
  }
}

app.get("/", (req, res) => res.redirect(currentUser(req) ? "/dashboard" : "/login"));

app.get("/login", (req, res) => res.render("login", { error: null }));

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = findUserByUsername((username || "").trim());
  if (!user || !bcrypt.compareSync(password || "", user.password)) {
    return res.render("login", { error: "Invalid username or password." });
  }
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET);
  res.cookie("token", token, { httpOnly: false });
  res.redirect(user.role === "admin" ? "/admin" : "/dashboard");
});

app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

app.get("/dashboard", requireAuth, (req, res) => {
  res.render("dashboard", { user: req.user });
});

app.get("/forgot-password", (req, res) => {
  res.render("forgot-password", { resetLink: null, error: null });
});

app.post("/forgot-password", (req, res) => {
  const user = findUserByUsername((req.body.username || "").trim());
  if (!user) {
    return res.render("forgot-password", { resetLink: null, error: "No account with that username." });
  }
  const token = generateResetToken(user.username);
  // A real app emails this link. This lab's mail server is switched off,
  // so — same as more than one real staging environment — the link comes
  // straight back in the response instead of only reaching an inbox.
  const resetLink = `/reset-password?token=${encodeURIComponent(token)}`;
  res.render("forgot-password", { resetLink, error: null });
});

app.get("/reset-password", (req, res) => {
  res.render("reset-password", { token: req.query.token || "", error: null, success: false });
});

app.post("/reset-password", (req, res) => {
  const { token, newPassword } = req.body;
  const user = resolveResetToken(token || "");

  if (!user) {
    return res.render("reset-password", { token, error: "That reset link is invalid or expired.", success: false });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.render("reset-password", { token, error: "Password must be at least 6 characters.", success: false });
  }

  user.password = bcrypt.hashSync(newPassword, 10);
  res.render("reset-password", { token, error: null, success: true });
});

app.get("/admin", requireAuth, requireAdmin, (req, res) => {
  res.render("admin", { user: req.user });
});

app.listen(PORT, () => {
  console.log(`Meridian lab listening on :${PORT}`);
});
