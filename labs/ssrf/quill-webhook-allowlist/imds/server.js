/**
 * Instance metadata service, IMDSv1 semantics: any GET from the instance
 * gets an answer, no token exchange, no PUT dance. Paths mirror the real
 * thing so what you learn here transfers unchanged.
 */
const express = require("express");

const app = express();
const PORT = process.env.PORT || 80;
const ROLE = "quill-webhook-dispatcher";

app.disable("x-powered-by");

app.get("/", (req, res) => res.type("text/plain").send("latest\n"));
app.get("/latest/meta-data/", (req, res) =>
  res.type("text/plain").send("ami-id\nhostname\niam/\ninstance-id\nplacement/\n"),
);
app.get("/latest/meta-data/instance-id", (req, res) => res.type("text/plain").send("i-0af31c9e77b204d18"));
app.get("/latest/meta-data/hostname", (req, res) => res.type("text/plain").send("quill-web-03.eu-west-1.internal"));
app.get("/latest/meta-data/iam/security-credentials/", (req, res) => res.type("text/plain").send(ROLE));

app.get(`/latest/meta-data/iam/security-credentials/${ROLE}`, (req, res) => {
  res.json({
    Code: "Success",
    LastUpdated: "2026-02-14T09:12:03Z",
    Type: "AWS-HMAC",
    AccessKeyId: "ASIA5EXAMPLE7QUILL42",
    SecretAccessKey: "HxBugLabs{us3r1nf0_1s_b3f0r3_th3_4t_n0t_4ft3r}",
    Token: "FwoGZXIvYXdzEBYaDJ-quill-dispatcher-session-token-v3",
    Expiration: "2026-02-14T15:12:03Z",
    // Deployment note left in the role document by the platform team.
    Notes: "Grants read on artifacts.internal (bearer = Token above).",
  });
});

app.use((req, res) => res.status(404).type("text/plain").send("Not Found"));

app.listen(PORT, () => console.log(`imds listening on :${PORT}`));
