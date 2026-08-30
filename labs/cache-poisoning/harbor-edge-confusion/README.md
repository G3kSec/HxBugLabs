# Harbor — an edge that keys on less than it serves

**Category:** Cache Poisoning · **Difficulty:** Hard

Harbor runs a customer portal behind its own caching edge. Two
containers: the edge is published to your host, the application origin is
on an internal network and is never reachable directly. Everything you do
goes through the cache, which is the point.

The edge's policy, from its runbook:

- static assets are always cached, decided by file extension — they carry
  no user data, so cookies are ignored when deciding
- the public pages (`/` and `/status`) are cached too, but only for
  requests arriving **without** a session cookie
- everything else is proxied straight through
- the cache is shared, so entries are keyed by method and URL

The origin is an ordinary application whose routes accept a format
suffix: `/account/profile.json` returns the same data as JSON.

Neither component is doing anything exotic.

## Run it

```bash
docker compose up -d
```

The portal is at **http://localhost:8087**.

## Your account

| Email | Password |
| --- | --- |
| `you@tenant.example` | `harbor-portal-2026` |

There is also a support agent, `agent.reyes@harbor.example`, whose
password you do not have. The portal has a **service desk queue**: paste
a portal path and an agent opens it, signed in as themselves, through the
edge. Same as a real support workflow.

## Tools the lab gives you

```
GET /_cache/status   what the edge is holding right now, and the key for each entry
GET /_cache/flush    empty the cache (an ops endpoint, and useful for winning a race)
GET /api/incidents   the integrity monitor's findings
```

`X-Harbor-Cache: HIT | MISS | BYPASS` is on every response. Read it
constantly — it is how you learn what the edge decided.

The integrity monitor fetches `/` through the edge every four seconds,
exactly as an anonymous visitor would, and records anything that would
make a browser load code from somewhere it should not.

## Objectives

Two flags, format `HxBugLabs{...}`. Hints are in `lab.yaml` and on the
catalog site. `SOLUTION.md` is a full spoiler.

## Tear down

```bash
docker compose down
```
