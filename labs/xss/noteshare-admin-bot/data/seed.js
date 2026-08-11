const bcrypt = require("bcryptjs");
const crypto = require("crypto");

function hash(plain) {
  return bcrypt.hashSync(plain, 10);
}

// The admin's password is intentionally not documented anywhere in this
// lab, including SOLUTION.md — you're never meant to log in as admin
// directly. You're meant to steal their session instead. That's the
// whole lab. Randomized per container start so it can't be hardcoded
// anywhere by accident.
const ADMIN_PASSWORD = crypto.randomBytes(16).toString("hex");

const users = [
  { id: 1, username: "mallory", password: hash("mallory123"), role: "customer", displayName: "Mallory Kim" },
  { id: 2, username: "admin", password: hash(ADMIN_PASSWORD), role: "admin", displayName: "Support Admin" },
];

const notes = [
  {
    id: 1,
    ownerId: 1,
    title: "Grocery list",
    body: "Eggs, oat milk, the good coffee, more oat milk because we always run out.",
  },
];

const collectedCookies = []; // { id, capturedFrom: 'admin', cookie, reportedUrl, capturedAt }

let nextNoteId = 2;
let nextCaptureId = 1;

function findUserByUsername(username) {
  return users.find((u) => u.username === username);
}

function findUserById(id) {
  return users.find((u) => u.id === id);
}

function findNoteById(id) {
  return notes.find((n) => n.id === id);
}

function notesForUser(userId) {
  return notes.filter((n) => n.ownerId === userId);
}

function createNote(ownerId, title, body) {
  const note = { id: nextNoteId++, ownerId, title, body };
  notes.push(note);
  return note;
}

function recordCapturedCookie(reportedUrl, cookie) {
  const capture = { id: nextCaptureId++, reportedUrl, cookie, capturedAt: new Date().toISOString() };
  collectedCookies.push(capture);
  return capture;
}

module.exports = {
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
};
