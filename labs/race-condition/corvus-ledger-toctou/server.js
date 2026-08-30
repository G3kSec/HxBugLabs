const path = require("node:path");

const bcrypt = require("bcryptjs");
const express = require("express");
const session = require("express-session");

const { lanes, findUserByEmail, findLane } = require("./data/seed");

const app = express();
const PORT = process.env.PORT || 8084;

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "corvus-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" },
  }),
);

const STARTING_CREDITS = 400;

/* One ledger per account, held in memory. A real deployment puts this in
   Postgres with row-level locking; the shapes of the bugs below are the
   same either way, because none of them would be inside a transaction. */
const accounts = new Map();

function accountFor(userId) {
  if (!accounts.has(userId)) {
    accounts.set(userId, { credits: STARTING_CREDITS, bookings: [], audit: [] });
  }
  return accounts.get(userId);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Round-trip to the settlement service. Every state change has to be
 * mirrored there before we persist it locally, which is why these
 * handlers are asynchronous in the middle.
 */
async function settlementRoundTrip() {
  await sleep(60 + Math.floor(Math.random() * 40));
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    if (req.originalUrl.startsWith("/api/")) return res.status(401).json({ error: "sign in first" });
    return res.redirect("/login");
  }
  next();
}

/* ── Booking ───────────────────────────────────────────────────────────
   Serialised behind a per-account promise chain after the incident in
   November: two concurrent bookings could both pass the balance check
   and overdraw the account. Every booking for an account now queues. */
const bookingLocks = new Map();

function withBookingLock(userId, task) {
  const previous = bookingLocks.get(userId) || Promise.resolve();
  const next = previous.then(task, task);
  bookingLocks.set(userId, next.catch(() => {}));
  return next;
}

async function bookLane(userId, laneCode) {
  const account = accountFor(userId);
  const lane = findLane(laneCode);
  if (!lane) return { error: "unknown lane" };

  if (account.credits < lane.credits) {
    return { error: `insufficient credits (need ${lane.credits}, have ${account.credits})` };
  }

  await settlementRoundTrip();

  account.credits -= lane.credits;
  const booking = {
    id: `BK-${String(account.bookings.length + 1).padStart(4, "0")}`,
    lane: lane.code,
    credits: lane.credits,
    state: "booked",
    createdAt: new Date().toISOString(),
  };
  account.bookings.push(booking);
  account.audit.push({ at: new Date().toISOString(), event: "booked", booking: booking.id, delta: -lane.credits });
  return { booking };
}

/* ── Routes ────────────────────────────────────────────────────────────── */

app.get("/", (req, res) => res.redirect(req.session.userId ? "/ledger" : "/login"));

app.get("/login", (req, res) => res.render("login", { error: null }));

app.post("/login", (req, res) => {
  const user = findUserByEmail(req.body.email);
  if (!user || !bcrypt.compareSync(req.body.password || "", user.password)) {
    return res.render("login", { error: "Those credentials didn't work." });
  }
  req.session.userId = user.id;
  accountFor(user.id);
  res.redirect("/ledger");
});

app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/login")));

app.get("/ledger", requireAuth, (req, res) => {
  const account = accountFor(req.session.userId);
  res.render("ledger", { account, lanes, charterCode: null });
});

app.get("/api/account", requireAuth, (req, res) => {
  const account = accountFor(req.session.userId);
  res.json({ credits: account.credits, bookings: account.bookings });
});

app.post("/api/bookings", requireAuth, async (req, res) => {
  const result = await withBookingLock(req.session.userId, () =>
    bookLane(req.session.userId, req.body.lane),
  );
  if (result.error) return res.status(400).json({ error: result.error });
  res.status(201).json(result.booking);
});

/* Cancelling reverses the charge. Not queued behind the booking lock:
   a cancellation only ever gives credits back, so it cannot overdraw an
   account, and putting it in the same queue made the UI feel slow. */
app.post("/api/bookings/:id/cancel", requireAuth, async (req, res) => {
  const account = accountFor(req.session.userId);
  const booking = account.bookings.find((b) => b.id === req.params.id);

  if (!booking) return res.status(404).json({ error: "no such booking" });
  if (booking.state !== "booked") {
    return res.status(409).json({ error: `booking is ${booking.state}` });
  }

  await settlementRoundTrip();

  account.credits += booking.credits;
  booking.state = "cancelled";
  account.audit.push({ at: new Date().toISOString(), event: "cancelled", booking: booking.id, delta: booking.credits });

  res.json({ booking, credits: account.credits });
});

/* Handing a booking to the carrier. Same shape as cancel: check the
   state, talk to settlement, write the state back. */
app.post("/api/bookings/:id/dispatch", requireAuth, async (req, res) => {
  const account = accountFor(req.session.userId);
  const booking = account.bookings.find((b) => b.id === req.params.id);

  if (!booking) return res.status(404).json({ error: "no such booking" });
  if (booking.state !== "booked") {
    return res.status(409).json({ error: `booking is ${booking.state}` });
  }

  await settlementRoundTrip();

  booking.state = "dispatched";
  booking.carrierRef = `CR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  account.audit.push({ at: new Date().toISOString(), event: "dispatched", booking: booking.id, delta: 0 });

  res.json({ booking });
});

/* The full-charter lane is priced above any funded balance. Booking it
   is the proof that the ledger was manipulated. */
app.get("/api/charter", requireAuth, (req, res) => {
  const account = accountFor(req.session.userId);
  const chartered = account.bookings.some((b) => b.lane === "CHARTER-ANR" && b.state !== "cancelled");
  if (!chartered) {
    return res.status(403).json({ error: "no active full-charter booking on this account" });
  }
  res.json({
    lane: "CHARTER-ANR",
    desk: "settlement@corvus.example",
    charterCode: "HxBugLabs{th3_r3fund_p4th_w4s_n3v3r_l0ck3d}",
  });
});

/* Settlement reconciliation. Flags bookings whose audit trail contains
   transitions that the state machine should have made mutually
   exclusive. */
app.get("/api/reconciliation", requireAuth, (req, res) => {
  const account = accountFor(req.session.userId);

  const conflicted = account.bookings.filter((b) => {
    const events = account.audit.filter((a) => a.booking === b.id).map((a) => a.event);
    return events.includes("cancelled") && events.includes("dispatched");
  });

  if (!conflicted.length) {
    return res.json({ conflicted: [], note: "every booking has a single terminal state" });
  }

  res.json({
    conflicted: conflicted.map((b) => ({ id: b.id, state: b.state, carrierRef: b.carrierRef || null })),
    note: "refunded and dispatched — escalate to the settlement desk",
    reconciliationToken: "HxBugLabs{tw0_3ndp01nts_0n3_0bj3ct_z3r0_l0cks}",
  });
});

app.get("/api/audit", requireAuth, (req, res) => {
  res.json({ audit: accountFor(req.session.userId).audit });
});

app.listen(PORT, () => console.log(`Corvus Freightpay listening on :${PORT}`));
