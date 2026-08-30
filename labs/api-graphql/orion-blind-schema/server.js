const path = require("node:path");

const bcrypt = require("bcryptjs");
const express = require("express");
const session = require("express-session");
const {
  execute,
  parse,
  specifiedRules,
  validate,
  NoSchemaIntrospectionCustomRule,
} = require("graphql");

const { schema } = require("./schema");
const { customers } = require("./data/seed");

const app = express();
const PORT = process.env.PORT || 8086;

app.disable("x-powered-by");
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "orion-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" },
  }),
);

/* Introspection is disabled in production. The rule below is the same one
   graphql-js ships for the purpose, so __schema and __type return a
   validation error rather than data. */
const VALIDATION_RULES = [...specifiedRules, NoSchemaIntrospectionCustomRule];

/* PIN confirmation is limited to ten attempts per minute per session,
   enforced here on the way in — the mutation resolver itself stays
   simple. */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const attempts = new Map();

function underRateLimit(sessionId) {
  const now = Date.now();
  const record = attempts.get(sessionId) || { count: 0, windowStart: now };

  if (now - record.windowStart > RATE_WINDOW_MS) {
    record.count = 0;
    record.windowStart = now;
  }

  record.count += 1;
  attempts.set(sessionId, record);
  return record.count <= RATE_MAX;
}

app.post("/session", (req, res) => {
  const customer = customers.find(
    (c) => c.login.toLowerCase() === String(req.body.login || "").trim().toLowerCase(),
  );
  if (!customer || !bcrypt.compareSync(req.body.password || "", customer.password)) {
    return res.status(401).json({ error: "invalid credentials" });
  }
  req.session.customerId = customer.id;
  res.json({ ok: true, customer: { id: customer.id, name: customer.name } });
});

app.post("/graphql", async (req, res) => {
  const { query, variables, operationName } = req.body || {};
  if (typeof query !== "string") {
    return res.status(400).json({ errors: [{ message: "no query supplied" }] });
  }

  let document;
  try {
    document = parse(query);
  } catch (error) {
    return res.status(400).json({ errors: [{ message: error.message }] });
  }

  const validationErrors = validate(schema, document, VALIDATION_RULES);
  if (validationErrors.length) {
    return res.status(400).json({ errors: validationErrors.map((e) => ({ message: e.message })) });
  }

  /* One rate-limit decision per incoming request, before the document is
     executed. Anything that confirms a payee is behind it. */
  if (/confirmPayee/.test(query) && !underRateLimit(req.sessionID)) {
    return res.status(429).json({ errors: [{ message: "too many PIN attempts, try again in a minute" }] });
  }

  const customer = req.session.customerId
    ? customers.find((c) => c.id === req.session.customerId)
    : null;

  const result = await execute({
    schema,
    document,
    contextValue: { customer },
    variableValues: variables,
    operationName,
  });

  res.json({
    data: result.data,
    ...(result.errors ? { errors: result.errors.map((e) => ({ message: e.message, path: e.path })) } : {}),
  });
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => console.log(`Orion Treasury API listening on :${PORT}`));
