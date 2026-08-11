const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");

const {
  users,
  tickets,
  internalNotes,
  findUserByUsername,
  findUserById,
  findTicketById,
  ticketsForUser,
} = require("./data/seed");

const app = express();
const PORT = process.env.PORT || 8080;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "0xbuglabs-helpdesk-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true },
  }),
);

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

// Defined, but deliberately never wired onto a route — see objective 2 in
// this lab's SOLUTION.md. This is exactly the "missing function level
// access control" pattern real bug bounty triagers see constantly: the
// helper exists, someone just forgot to actually call it.
function requireAgent(req, res, next) {
  const user = findUserById(req.session.userId);
  if (!user || user.role !== "agent") {
    return res.status(403).send("Forbidden — agent role required.");
  }
  next();
}

app.get("/", (req, res) => {
  res.redirect(req.session.userId ? "/dashboard" : "/login");
});

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = findUserByUsername((username || "").trim());

  if (!user || !bcrypt.compareSync(password || "", user.password)) {
    return res.render("login", { error: "Invalid username or password." });
  }

  req.session.userId = user.id;
  res.redirect("/dashboard");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/dashboard", requireAuth, (req, res) => {
  const user = findUserById(req.session.userId);
  res.render("dashboard", { user, tickets: ticketsForUser(user.id) });
});

app.get("/tickets/new", requireAuth, (req, res) => {
  res.render("new-ticket", { user: findUserById(req.session.userId), error: null });
});

app.post("/tickets/new", requireAuth, (req, res) => {
  const { subject, body } = req.body;
  if (!subject || !body) {
    return res.render("new-ticket", {
      user: findUserById(req.session.userId),
      error: "Subject and description are both required.",
    });
  }

  const ticket = {
    id: tickets.length + 1,
    ownerId: req.session.userId,
    subject: subject.trim(),
    body: body.trim(),
    status: "open",
  };
  tickets.push(ticket);
  res.redirect(`/tickets/${ticket.id}`);
});

// --- Objective 1 lives here -------------------------------------------
// Loads a ticket by ID with no check that req.session.userId actually
// owns it. Any authenticated customer can walk the ID space.
app.get("/tickets/:id", requireAuth, (req, res) => {
  const ticket = findTicketById(Number(req.params.id));
  if (!ticket) return res.status(404).send("Ticket not found.");

  res.render("ticket", { user: findUserById(req.session.userId), ticket });
});

// --- Objective 2 lives here ---------------------------------------------
// Only requireAuth is applied. requireAgent exists above and is never
// used — any logged-in customer who guesses or finds this route sees the
// full internal queue.
app.get("/agent/dashboard", requireAuth, (req, res) => {
  const user = findUserById(req.session.userId);
  res.render("agent-dashboard", { user, tickets, users, internalNotes });
});

app.listen(PORT, () => {
  console.log(`HelpDesk lab listening on :${PORT}`);
});
