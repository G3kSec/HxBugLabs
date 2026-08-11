# 0xBugLabs

Self-hosted, Docker-based vulnerable labs for practicing bug bounty web
vulnerabilities and recon techniques — plus a catalog site to browse and run
them locally.

**Status: Phase 1 in progress.** One real lab built and tested end to end.
See [Roadmap](#roadmap).

## Why

Existing options cover parts of this, not all of it:

| | Self-hosted | Difficulty & category | Objectives / flags | Browsable catalog |
| --- | --- | --- | --- | --- |
| [Vulhub](https://github.com/vulhub/vulhub) | Yes | No | No | Yes |
| PortSwigger Web Security Academy | No | Yes | Yes | Yes |
| HackTheBox Academy | No | Yes | Yes | Yes |
| DVWA / Juice Shop | Yes | Partial | No flags | Single app, not a catalog |
| **0xBugLabs** | Yes | Yes | Yes | Yes |

Vulhub gets you many isolated Docker environments with a browsable
catalog, but no difficulty tiers, no categories, no objectives — just CVE
reproductions. PortSwigger and HTB Academy get the pedagogy right but
neither is self-hostable. Nothing combines both.

## How it works

One lab = one self-contained folder: a `docker-compose.yml` that runs it,
and a `lab.yaml` that describes it. No database — the catalog site (Phase 2)
reads every `lab.yaml` at build time, same content-as-code model already
running in [0xBugLetter](https://github.com/G3kSec/0xBugLetter). Only the
catalog site deploys anywhere (Vercel); the labs themselves never leave
your machine.

Labs are **toy apps, not real CVE reproductions** — faster to build, safer
to run, and the difficulty is exactly as tunable as the story needs. A lab
can have **more than one objective**, on purpose: real targets rarely have
just one bug, and chaining a low-priv find into something bigger is closer
to how an actual engagement goes than a single flag ever is.

```
labs/idor/helpdesk-ticket-access/
├── docker-compose.yml   # docker compose up -d — that's it
├── Dockerfile
├── lab.yaml             # metadata the catalog site reads
├── package.json / server.js / views/   # the vulnerable app itself
├── README.md            # scope + how to run, no spoilers
└── SOLUTION.md          # full walkthrough, one section per objective
```

```yaml
# labs/idor/helpdesk-ticket-access/lab.yaml
title: "Acme HelpDesk — ticket access control"
slug: "helpdesk-ticket-access"
category: "Access Control / IDOR"
difficulty: "Easy"
tech: ["Node.js", "Express", "EJS"]
port: 8080

description: >-
  A small internal support-ticket portal. You're given one low-privilege
  customer account — everything else is yours to find.

objectives:
  - id: "read-foreign-ticket"
    title: "Read another customer's ticket"
    description: "..."
    flag: "0xBugLabs{h0riz0nt4l_1d0r_1s_st1ll_a_bug}"
  - id: "reach-agent-console"
    title: "Reach the internal agent console"
    description: "..."
    flag: "0xBugLabs{v3rt1c4l_4cc3ss_c0ntr0l_m1ss1ng}"

tags: ["idor", "broken-access-control"]
```

Flags are static, baked into the app at build time — one per objective, not
one per lab. Dynamic per-team flags exist to stop flag-sharing in
competitive CTF events; irrelevant here, this is a single-player trainer.
`scripts/validate.py` enforces flags are globally unique across the repo
and match `0xBugLabs{...}`.

## Structure

```
├── labs/                 The actual content, one dir per category
│   └── idor/
│       └── helpdesk-ticket-access/   First seed lab — see below
├── web/                  Next.js catalog (Phase 2, not started)
├── data/
│   └── taxonomy.yaml     Closed category/difficulty lists
├── scripts/
│   ├── validate.py       lab.yaml schema check
│   └── new_lab.py        Scaffolds a new lab folder from a template
└── SECURITY.md           Isolation rules — read before running anything
```

## The first lab

**`labs/idor/helpdesk-ticket-access`** — a support-ticket portal with two
objectives: a horizontal IDOR (read another customer's ticket by walking
sequential IDs) and a vertical one (reach a staff-only console the UI never
links to, because the route is missing its authorization check — not
missing auth entirely, just the *role* check, which is the more realistic
and more common mistake). Full app, real login flow, bcrypt-hashed
passwords, nothing about the bug telegraphed in the UI.

Tested end to end: logged in, walked ticket IDs, hit the agent console,
confirmed both flags are only reachable by actually exploiting each bug
(verified negative cases too — no session, wrong password, both correctly
rejected). **Not yet verified**: an actual `docker compose up` build — the
Docker daemon wasn't running when this was built, so the Dockerfile is
carefully written but unconfirmed. Worth a real `docker compose up -d` the
next time Docker Desktop is open.

## Safety

These are deliberately vulnerable containers. Run on `localhost` only,
never on a publicly reachable IP, never on a machine that also holds
anything sensitive. Full notes in [SECURITY.md](SECURITY.md).

## Roadmap

- **Phase 0 — Repo scaffold** *(done)*: plan, folder structure, taxonomy.
- **Phase 1 — Foundation + seed labs** *(in progress)*: `scripts/validate.py`
  and `scripts/new_lab.py` done; first lab (IDOR, two objectives) built and
  tested. Remaining: XSS, SSRF, Auth, one Recon/OSINT challenge.
- **Phase 2 — Catalog site**: Next.js SSG over `labs/**/lab.yaml`, `/labs`
  listing with filters, `/labs/[slug]` detail pages, collapsed solutions.
- **Phase 3 — Progress + polish**: local progress tracking (no auth needed,
  single-user, tracked per-objective not just per-lab), stats page, CI
  smoke-test that every `docker-compose` actually builds.

## Open decisions

- **Catalog site hosting** — Vercel, matching the rest of the 0x family.
  Site only, never the labs themselves. Needs to stay private
  (password-protected or undeployed) while this repo is private.
- **Remaining seed labs** — confirm the XSS / SSRF / Auth / Recon list, or
  swap categories, before building the next batch in the same shape as
  `helpdesk-ticket-access`.
