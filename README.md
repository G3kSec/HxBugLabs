# HxBugLabs

Self-hosted, Docker-based vulnerable labs for practicing bug bounty web
vulnerabilities and recon techniques — plus a catalog site to browse and run
them locally.

**[buglabs.hxhunt.com](https://buglabs.hxhunt.com/)**

Twelve labs, twenty-five objectives, every one of them built and exercised
end to end against the running app.

## How it works

One lab = one self-contained folder: a `docker-compose.yml` that runs it,
and a `lab.yaml` that describes it. No database — the catalog site reads
every `lab.yaml` at build time, same content-as-code model already running
in [HxBugLetter](https://github.com/G3kSec/HxBugLetter). Only the catalog
site deploys anywhere (Vercel); the labs themselves never leave your
machine.

Labs are **toy apps, not real CVE reproductions** — faster to build, safer
to run, and the difficulty is exactly as tunable as the story needs. A lab
can have **more than one objective**, on purpose: real targets rarely have
just one bug, and chaining a low-priv find into something bigger is closer
to how an actual engagement goes than a single flag ever is.

Two rules the labs try hard to keep:

- **No tells in the UI.** Real login flows, bcrypt-hashed passwords, no
  "you found it!" banners, and no comments in the app pointing at the bug.
  Several labs ship a control the player is expected to test and find
  *working* — the login that is properly hardened, the endpoint that is
  properly locked — because knowing what is already fixed is how you
  decide where to look next.
- **The root cause is the deliverable.** Every `SOLUTION.md` ends with
  why the bug existed, the payload family it belongs to, how to find the
  same class on a real target, and how it should be reported.

```
labs/idor/clearline-tenant-boundary/
├── docker-compose.yml   # docker compose up -d — that's it
├── Dockerfile
├── lab.yaml             # metadata the catalog site reads
├── package.json / server.js / views/   # the vulnerable app itself
├── README.md            # scope + how to run, no spoilers
└── SOLUTION.md          # full walkthrough, one section per objective
```

```yaml
# labs/idor/clearline-tenant-boundary/lab.yaml
title: "Clearline — the tenant boundary that only exists in the browser"
slug: "clearline-tenant-boundary"
category: "Access Control / IDOR"
difficulty: "Easy"
tech: ["Node.js", "Express", "EJS", "REST"]
port: 8081

description: >-
  A multi-tenant contract workspace. Every identifier is a UUID, so there
  is nothing to enumerate — which is exactly when teams stop writing the
  ownership check.

objectives:
  - id: "read-foreign-contract"
    title: "Read a contract that belongs to another workspace"
    description: "..."
    flag: "HxBugLabs{unguess4bl3_1ds_4r3_n0t_4cc3ss_c0ntr0l}"
    hints:
      - "Search for a common word and compare what the page shows against what the API returned."
  - id: "sunset-api-export"
    title: "Bulk-export a workspace through an API that was retired on paper"
    description: "..."
    flag: "HxBugLabs{sh4d0w_4p1_v1_n3v3r_g0t_th3_f1x}"

tags: ["idor", "broken-access-control", "multi-tenancy", "shadow-api"]
```

Flags are static, baked into the app at build time — one per objective, not
one per lab. Dynamic per-team flags exist to stop flag-sharing in
competitive CTF events; irrelevant here, this is a single-player trainer.
`scripts/validate.py` enforces flags are globally unique across the repo
and match `HxBugLabs{...}`.

## The labs

| Lab | Category | Difficulty | Port |
| --- | --- | --- | --- |
| [Vega Freight](labs/recon/vega-exposed-artifacts) — source maps and a forgotten vhost | Recon / OSINT | Easy | 8080 |
| [Clearline](labs/idor/clearline-tenant-boundary) — client-side tenant filtering, shadow API | Access Control / IDOR | Easy | 8081 |
| [Atrium](labs/file-upload/atrium-avatar-pipeline) — SVG upload, folder traversal | File Upload | Easy | 8091 |
| [Atlas Payroll](labs/auth/atlas-stepup-mfa) — OTP resend stacks the keyspace | Auth | Medium | 8082 |
| [Quill](labs/ssrf/quill-webhook-allowlist) — userinfo bypass to cloud metadata | SSRF | Medium | 8083 |
| [Corvus Freightpay](labs/race-condition/corvus-ledger-toctou) — refund race and multi-endpoint race | Race Condition | Medium | 8084 |
| [Blackthorn ATS](labs/sqli/blackthorn-operator-injection) — operator injection, blind regex oracle | SQL / NoSQL Injection | Medium | 8090 |
| [Mosaic Status](labs/xss/mosaic-status-mxss) — sanitizer re-serialization, CSP bypass via JSONP | XSS | Hard | 8085 |
| [Orion Treasury](labs/api-graphql/orion-blind-schema) — schema recovery without introspection, alias batching | API / GraphQL | Hard | 8086 |
| [Harbor](labs/cache-poisoning/harbor-edge-confusion) — cache deception and unkeyed-header poisoning | Cache Poisoning | Hard | 8087 |
| [Kestrel Reports](labs/prototype-pollution/kestrel-report-merge) — deep merge to authz bypass and RCE | Prototype Pollution | Hard | 8088 |
| [Lantern](labs/ssti/lantern-campaign-preview) — denylist bypass to template RCE | SSTI | Hard | 8092 |

Every lab publishes one port and is reachable at `http://localhost:<port>`.
Ports are unique across the repo, so several can run at once.

## Running one

```bash
git clone https://github.com/G3kSec/HxBugLabs.git
cd HxBugLabs/labs/idor/clearline-tenant-boundary
docker compose up -d
```

Credentials, scope and the API surface are in each lab's `README.md`.
Objectives and progressive hints are in `lab.yaml` and on the catalog
site. `SOLUTION.md` is a full spoiler — it is there for after, or for when
you are properly stuck.

## Tracking progress

The catalog site has a flag box on every objective. Paste a captured flag
and it is recorded as solved.

Progress lives in **`localStorage`, in that browser, and nowhere else** —
there is no account, no backend, and nothing is sent anywhere. Clearing
site data clears it.

The site never ships the flags themselves: `lab.yaml` keeps the plaintext,
the build hashes it with SHA-256, and only the hash reaches the bundle, so
the checker can tell you whether you are right without the answer being in
view-source. A hash of a known-format string is not a vault — someone
determined can grind it — but it stops the accidental spoiler, which is
what it is for.

## Structure

```
├── labs/                 The actual content, one dir per category
│   ├── api-graphql/  auth/  cache-poisoning/  file-upload/
│   ├── idor/  prototype-pollution/  race-condition/  recon/
│   └── sqli/  ssrf/  ssti/  xss/
├── web/                  Next.js catalog — live at buglabs.hxhunt.com
├── data/
│   └── taxonomy.yaml     Closed category/difficulty lists
├── scripts/
│   ├── validate.py       lab.yaml schema check
│   └── new_lab.py        Scaffolds a new lab folder from a template
└── SECURITY.md           Isolation rules — read before running anything
```

## Adding a lab

```bash
python scripts/new_lab.py idor another-access-control-bug \
  --title "Another access control bug" --difficulty Medium --port 8093
python scripts/validate.py
```

The validator enforces the schema, the closed taxonomy in
`data/taxonomy.yaml`, unique ports, unique flags, and that every lab ships
a `docker-compose.yml`, a `README.md`, a `SOLUTION.md` and at least one
`Dockerfile`. CI runs it on every PR alongside the site build.

## Safety

These are deliberately vulnerable containers, and two of them
(`kestrel-report-merge`, `lantern-campaign-preview`) end in command
execution inside their own container by design. Run on `localhost` only,
never on a publicly reachable IP, never on a machine that also holds
anything sensitive. Full notes in [SECURITY.md](SECURITY.md).
