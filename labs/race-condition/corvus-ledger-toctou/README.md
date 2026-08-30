# Corvus Freightpay — the lock that guards the wrong door

**Category:** Race Condition · **Difficulty:** Medium

Corvus is a freight settlement platform. You hold a credit balance, book
lanes against it, cancel what you no longer need, and dispatch what you
do.

The team has been burned by a concurrency bug before. The endpoint you
would attack first is properly serialised, and you can prove that to
yourself in about a minute. The bugs are in the two places nobody thought
to lock.

## Run it

```bash
docker compose up -d
```

The app is at **http://localhost:8084**.

## Your account

| Email | Password |
| --- | --- |
| `ops@brightwell-haulage.example` | `Freight!2026` |

You start with **400 credits**. The full-charter lane costs 5,000 — it is
priced so that no funded account can reach it, which makes booking it
proof that the ledger was manipulated rather than merely used.

## The API

The ledger page lists every route, and they all take a session cookie:

```
GET  /api/account                     balance + bookings
POST /api/bookings                    {"lane":"RTM-SNT"}
POST /api/bookings/:id/cancel
POST /api/bookings/:id/dispatch
GET  /api/audit                       every ledger movement
GET  /api/reconciliation              settlement's conflict check
GET  /api/charter                     needs an active full-charter booking
```

State is per-process and in memory. Restart the container to reset the
account to 400 credits and no bookings.

## Objectives

Two flags, format `HxBugLabs{...}`. Both need concurrent requests —
Burp's Turbo Intruder, `xargs -P`, or twenty threads in a script all
work. `SOLUTION.md` is a full spoiler.

## Tear down

```bash
docker compose down
```
