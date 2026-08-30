# Lantern — a preview that renders more than the preview

**Category:** SSTI · **Difficulty:** Hard

Lantern is an email marketing tool. Campaign bodies are templates with
merge tags — `{{ recipient.firstName }}`, `{{ workspace.name }}` — and
the editor has a preview button that renders your draft against a sample
recipient.

The template you write is compiled by the server, in the server's
process. There is a denylist between you and the parts of that process
you are not meant to touch.

> **This lab ends in command execution inside its container.** That is the
> objective. Read [SECURITY.md](../../../SECURITY.md) first, and do not
> run it on a machine you care about.

## Run it

```bash
docker compose up -d
```

The API is at **http://localhost:8092** (open it for the merge-tag
reference and the route list).

## Your account

| Email | Password |
| --- | --- |
| `marketing@brightwell.example` | `Lantern-Campaigns-2026` |

```bash
curl -s -c jar -X POST http://localhost:8092/api/session \
  -H 'Content-Type: application/json' \
  -d '{"email":"marketing@brightwell.example","password":"Lantern-Campaigns-2026"}'
```

## The API

```
GET  /api/campaigns
PUT  /api/campaigns/:id           {"body": "...", "subject": "..."}
POST /api/campaigns/:id/preview   {"body": "..."}  renders a draft without saving
```

Preview is the one to work with — it renders whatever body you send,
without saving it.

## Objectives

Two flags, format `HxBugLabs{...}`. The first needs no bypass at all, only
a correct idea of what a template engine is. Hints are in `lab.yaml` and
on the catalog site; `SOLUTION.md` is a full spoiler.

## Tear down

```bash
docker compose down
```
