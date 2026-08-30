# Kestrel Reports — one merge, two escalations

**Category:** Prototype Pollution · **Difficulty:** Hard

Kestrel is a reporting workspace with no web UI yet — the desktop client
talks to the API directly, and so do you. Your account is an **analyst**:
you can read reports, and that is all.

Two things above your level are gated by an authorization helper, and one
of them shells out to a binary.

> **This lab ends in command execution inside its container.** That is the
> objective, not an accident. Read [SECURITY.md](../../../SECURITY.md)
> before running it, and do not run it on a machine you care about.

## Run it

```bash
docker compose up -d
```

The API is at **http://localhost:8088** (open it in a browser for the
route list).

## Your account

| Email | Password |
| --- | --- |
| `analyst@northgate.example` | `Kestrel-Reports-2026` |

```bash
curl -s -c jar -X POST http://localhost:8088/api/session \
  -H 'Content-Type: application/json' \
  -d '{"email":"analyst@northgate.example","password":"Kestrel-Reports-2026"}'
```

## The API

```
GET    /api/preferences         your preference document
PATCH  /api/preferences         deep-merges the JSON body into it

GET    /api/reports             reports in your workspace
GET    /api/exports             full export        (needs exports:read)
POST   /api/reports/:id/render  hands a report to the engine (needs reports:render)
```

Roles: `analyst` reads reports. `finance` also renders and exports.
`admin` does both plus workspace management.

## Objectives

Two flags, format `HxBugLabs{...}`. The second is a file on disk inside
the container. Hints are in `lab.yaml` and on the catalog site;
`SOLUTION.md` is a full spoiler.

State lives in the process. `docker compose restart kestrel` clears any
pollution and gives you a clean instance.

## Tear down

```bash
docker compose down
```
