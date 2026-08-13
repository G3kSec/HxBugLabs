# 0xBugLabs

Self-hosted, Docker-based vulnerable labs for practicing bug bounty web
vulnerabilities and recon techniques — plus a catalog site to browse and run
them locally.

**[0xbuglabs.g3ksec.xyz](https://0xbuglabs.g3ksec.xyz/)**

**Status: Beta.** Five labs built and tested end to end against real Docker
containers, catalog site live. Still actively adding labs and polish — see
[Roadmap](#roadmap).

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
and a `lab.yaml` that describes it. No database — the catalog site reads
every `lab.yaml` at build time, same content-as-code model already running
in [0xBugLetter](https://github.com/G3kSec/0xBugLetter). Only the catalog
site deploys anywhere (Vercel); the labs themselves never leave your
machine.

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
│   ├── idor/helpdesk-ticket-access/
│   ├── xss/noteshare-admin-bot/
│   ├── ssrf/linkpreview-internal-pivot/
│   ├── auth/meridian-token-flaws/
│   └── recon/acme-attack-surface/
├── web/                  Next.js catalog — live at 0xbuglabs.g3ksec.xyz
├── data/
│   └── taxonomy.yaml     Closed category/difficulty lists
├── scripts/
│   ├── validate.py       lab.yaml schema check
│   └── new_lab.py        Scaffolds a new lab folder from a template
└── SECURITY.md           Isolation rules — read before running anything
```

## The labs

Five labs, each a self-contained Docker Compose stack, each tested against
real containers — built, run, exploited through every objective, torn down.

| Lab | Category | Difficulty | Objectives |
| --- | --- | --- | --- |
| [`idor/helpdesk-ticket-access`](labs/idor/helpdesk-ticket-access) | Access Control / IDOR | Easy | Horizontal IDOR (read another customer's ticket) + vertical (reach a staff console missing its role check) |
| [`xss/noteshare-admin-bot`](labs/xss/noteshare-admin-bot) | XSS | Medium | Reflected XSS with real browser execution + session theft via a headless admin bot that "reviews" reported content |
| [`ssrf/linkpreview-internal-pivot`](labs/ssrf/linkpreview-internal-pivot) | SSRF | Medium | Denylist bypass to reach an unpublished internal container + pivot to an endpoint it doesn't advertise |
| [`auth/meridian-token-flaws`](labs/auth/meridian-token-flaws) | Auth | Medium | Predictable password-reset token (base64, not encryption) + JWT `alg: none` signature-check bypass |
| [`recon/acme-attack-surface`](labs/recon/acme-attack-surface) | Recon / OSINT | Easy | Content discovery via `robots.txt` → exposed backup file + asset discovery via exposed `.git/config` → forgotten second host |

Each one is a full app: real auth flows, bcrypt-hashed passwords, no
"you found it!" banners or other tells baked into the UI. The bug is only
findable by actually exploiting it, and every objective was verified
against its negative case too (wrong session, wrong token, blocked host)
to confirm the flag isn't reachable any other way.

A couple of real bugs surfaced while building these, worth noting because
they're the kind of thing that bites in production too: a Docker Compose
`internal: true` network blocks host port-publishing entirely, not just
outbound egress as the network flag's name suggests (fixed by only
isolating the specific service that needs to be unreachable, never a
lab's main published service — see [SECURITY.md](SECURITY.md)); and the
schema validator originally assumed every lab's `Dockerfile` sat next to
its `lab.yaml`, which breaks for any multi-container lab.

## Safety

These are deliberately vulnerable containers. Run on `localhost` only,
never on a publicly reachable IP, never on a machine that also holds
anything sensitive. Full notes in [SECURITY.md](SECURITY.md).

## Roadmap

- **Phase 0 — Repo scaffold** *(done)*: plan, folder structure, taxonomy.
- **Phase 1 — Foundation + seed labs** *(done)*: `scripts/validate.py` and
  `scripts/new_lab.py` done; five labs built and tested end to end
  (IDOR, XSS, SSRF, Auth, Recon/OSINT).
- **Phase 2 — Catalog site** *(done)*: Next.js SSG over `labs/**/lab.yaml`,
  `/labs` listing with filters, `/labs/[slug]` detail pages, optional
  collapsed hints per objective. Live at
  [0xbuglabs.g3ksec.xyz](https://0xbuglabs.g3ksec.xyz/), flagged beta on
  the site while more labs get added.
- **Phase 3 — Progress + polish**: local progress tracking (no auth needed,
  single-user, tracked per-objective not just per-lab), stats page, CI
  smoke-test that every `docker-compose` actually builds, more labs.

## Open decisions

- **Catalog site hosting** — Vercel, matching the rest of the 0x family.
  Site only, never the labs themselves — those only ever run on
  `localhost`. See [SECURITY.md](SECURITY.md).
