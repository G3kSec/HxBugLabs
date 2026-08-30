const fs = require("node:fs");
const path = require("node:path");

const bcrypt = require("bcryptjs");
const express = require("express");
const session = require("express-session");
const multer = require("multer");

const { staff, findByEmail, findById } = require("./data/seed");

const app = express();
const PORT = process.env.PORT || 8091;

const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* Formats the directory accepts for a profile picture. Anything that
   could be executed by a server — .php, .jsp, .aspx, .cgi — is absent by
   construction: this is an allow-list, not a denylist. */
const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
const MAX_BYTES = 2 * 1024 * 1024;

const storage = multer.diskStorage({
  /* Avatars are filed under the uploader's team so the directory export
     job can pick up one folder per team. The client passes the folder it
     is filing into. */
  destination: (req, file, cb) => {
    const folder = String(req.query.folder || "").trim();
    const target = folder ? path.join(UPLOAD_DIR, folder) : UPLOAD_DIR;
    fs.mkdirSync(target, { recursive: true });
    cb(null, target);
  },
  /* Keep the name the person uploaded, so a saved copy of the photo has
     a sensible file name rather than a random hash. */
  filename: (req, file, cb) => cb(null, file.originalname),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return cb(new Error(`only ${ALLOWED_EXTENSIONS.join(", ")} are accepted`));
    }
    cb(null, true);
  },
});

app.disable("x-powered-by");
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "atrium-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" },
  }),
);

/* Avatars are served from the same origin as the directory so the images
   are not blocked by the app's own connect-src policy. */
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(PUBLIC_DIR));

function currentUser(req) {
  return req.session.userId ? findById(req.session.userId) : null;
}

function requireAuth(req, res, next) {
  if (!currentUser(req)) return res.status(401).json({ error: "sign in first" });
  next();
}

/* ── Directory ─────────────────────────────────────────────────────────── */

app.post("/api/session", (req, res) => {
  const user = findByEmail(req.body.email);
  if (!user || !bcrypt.compareSync(req.body.password || "", user.password)) {
    return res.status(401).json({ error: "invalid credentials" });
  }
  req.session.userId = user.id;
  res.json({ ok: true, name: user.name, email: user.email });
});

app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get("/api/staff", (req, res) => {
  res.json({
    staff: staff.map((s) => ({
      id: s.id,
      name: s.name,
      title: s.title,
      team: s.team,
      avatar: s.avatar,
    })),
  });
});

app.post("/api/avatar", requireAuth, (req, res) => {
  upload.single("avatar")(req, res, (error) => {
    if (error) return res.status(400).json({ error: error.message });
    if (!req.file) return res.status(400).json({ error: "no file received" });

    const user = currentUser(req);
    const folder = String(req.query.folder || "").trim();
    user.avatar = `/uploads/${folder ? `${folder}/` : ""}${req.file.originalname}`;

    res.json({
      ok: true,
      storedAs: req.file.originalname,
      storedIn: req.file.destination,
      servedAt: user.avatar,
      bytes: req.file.size,
    });
  });
});

/* ── Upload audit ──────────────────────────────────────────────────────
   Written for the platform team after the directory migration, so they
   could confirm nothing unexpected had landed in the web root. */

const ACTIVE_EXTENSIONS = new Set([".svg", ".html", ".htm", ".xhtml", ".xml", ".js", ".mjs"]);

function listFiles(directory, base = directory) {
  if (!fs.existsSync(directory)) return [];
  const out = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else if (entry.name !== ".gitkeep") out.push(full);
  }
  return out;
}

app.get("/api/uploads/audit", (req, res) => {
  const inUploads = listFiles(UPLOAD_DIR);

  /* Files sitting in the web root that were not part of the deployment. */
  const shipped = new Set(["index.html", "atrium.css"]);
  const strayInPublic = listFiles(PUBLIC_DIR).filter(
    (file) => !shipped.has(path.relative(PUBLIC_DIR, file)),
  );

  const activeInUploads = inUploads.filter((file) =>
    ACTIVE_EXTENSIONS.has(path.extname(file).toLowerCase()),
  );

  const findings = {};
  if (activeInUploads.length) {
    findings.activeContentHosted = {
      files: activeInUploads.map((f) => `/uploads/${path.relative(UPLOAD_DIR, f)}`),
      note: "served from the application origin with an executable content type",
      flag: "HxBugLabs{n0t_3v3ry_1m4g3_f0rm4t_1s_1n3rt}",
    };
  }
  if (strayInPublic.length) {
    findings.escapedUploadDirectory = {
      files: strayInPublic.map((f) => path.relative(PUBLIC_DIR, f)),
      note: "written outside the upload directory",
      flag: "HxBugLabs{4_f1l3n4m3_1s_4_p4th_unt1l_y0u_str1p_1t}",
    };
  }

  res.json({
    uploadDirectory: "/app/uploads",
    webRoot: "/app/public",
    counts: { uploads: inUploads.length, strayInWebRoot: strayInPublic.length },
    ...(Object.keys(findings).length ? { findings } : { findings: "nothing anomalous" }),
  });
});

app.listen(PORT, () => console.log(`Atrium listening on :${PORT}`));
