# 0xBugLabs

Self-hosted, Docker-based vulnerable labs for practicing bug bounty web
vulnerabilities and recon techniques — plus a catalog site to browse and run
them locally.

**[0xbuglabs.g3ksec.xyz](https://0xbuglabs.g3ksec.xyz/)**

**Status: Beta.** Five labs built and tested end to end against real Docker
containers, catalog site live. Still actively adding labs and polish.

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

Browse the current lab list on the [catalog site](https://0xbuglabs.g3ksec.xyz/labs)
or under [`labs/`](labs). Each one is a full app: real auth flows,
bcrypt-hashed passwords, no "you found it!" banners or other tells baked
into the UI.

## Safety

These are deliberately vulnerable containers. Run on `localhost` only,
never on a publicly reachable IP, never on a machine that also holds
anything sensitive. Full notes in [SECURITY.md](SECURITY.md).
