# 0xBugLabs

Self-hosted, Docker-based vulnerable labs for practicing bug bounty web
vulnerabilities and recon techniques — plus a catalog site to browse and run
them locally.

**Status: proposal / Phase 0.** This repo exists, the plan is written down,
no labs or site yet. See [Phase 1](#roadmap) for what's next.

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
running in [0xBugLetter](https://github.com/G3kSec/0xBugLetter).

```
labs/idor/orders-api-basic/
├── docker-compose.yml   # docker compose up -d — that's it
├── Dockerfile
├── lab.yaml             # metadata the catalog site reads
├── app/                 # the vulnerable app source
├── README.md            # objective, no spoilers
└── SOLUTION.md          # walkthrough — collapsed on the site by default
```

```yaml
# labs/idor/orders-api-basic/lab.yaml
title: "Orders API — sequential ID exposure"
slug: "orders-api-basic"
category: "Access Control / IDOR"
difficulty: "Easy"
tech: ["Node.js", "Express", "SQLite"]
port: 8080

objective: "Read another user's order without authorization."
flag_format: "0xBugLabs{...}"

tags:
  - "idor"
  - "rest-api"
  - "authorization"
```

Flags are static, baked into the image at build time. Dynamic per-team
flags exist to stop flag-sharing in competitive CTF events — irrelevant
here, this is a single-player trainer.

## Structure

```
├── labs/                 The actual content, one dir per category
│   ├── idor/
│   ├── ssrf/
│   ├── xss/
│   ├── recon/            OSINT / recon-technique challenges
│   └── ...
├── web/                  Next.js catalog (Phase 2, not started)
├── data/
│   └── taxonomy.yaml     Closed category/difficulty lists
├── scripts/
│   ├── validate.py       lab.yaml schema check
│   └── new_lab.py        Scaffolds a new lab folder from a template
└── SECURITY.md           Isolation rules — read before running anything
```

## Safety

These are deliberately vulnerable containers. Run on `localhost` only,
never on a publicly reachable IP, never on a machine that also holds
anything sensitive. Full notes in [SECURITY.md](SECURITY.md).

## Roadmap

- **Phase 0 — Repo scaffold** *(done)*: this plan, folder structure,
  taxonomy drafted.
- **Phase 1 — Foundation + seed labs**: `data/taxonomy.yaml` finalized,
  `scripts/validate.py`, `scripts/new_lab.py`, 3–5 seed labs spanning
  different categories (IDOR, XSS, SSRF, Auth, one Recon/OSINT challenge).
- **Phase 2 — Catalog site**: Next.js SSG over `labs/**/lab.yaml`, `/labs`
  listing with filters, `/labs/[slug]` detail pages, collapsed solutions.
- **Phase 3 — Progress + polish**: local progress tracking (no auth needed,
  single-user), stats page, CI smoke-test that every `docker-compose`
  actually builds.

## Open decisions

- **Toy apps vs. real CVE reproductions** — leaning toy-first for the seed
  labs (faster to build, safer, easier to tune to an exact difficulty);
  CVE-reproduction labs could come later as a separate, clearly-labeled
  track.
- **Seed lab list** — proposed: IDOR, XSS, SSRF, Auth, and one Recon/OSINT
  challenge.
- **Catalog site hosting** — Vercel, matching the rest of the 0x family,
  but needs to stay private (password-protected or undeployed) while this
  repo is private.
