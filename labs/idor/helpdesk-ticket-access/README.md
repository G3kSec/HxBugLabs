# Acme HelpDesk — ticket access control

**Category:** Access Control / IDOR · **Difficulty:** Easy

A support-ticket portal for Acme Corp's customers. Think of this as a
scoped engagement: you're handed one low-privilege account, and everything
you find beyond what that account is supposed to see is fair game.

## Run it

```bash
docker compose up -d
```

The app is at **http://localhost:8080**.

## Your account

| Username | Password |
| --- | --- |
| `alice` | `alice123` |

That's the only credential you're given. Everything else — other
customers' data, staff-only areas — you find on your own, same as a real
target.

## Objectives

Two flags in this lab, in the format `0xBugLabs{...}`. See `lab.yaml` for
the exact objective descriptions. No further hints here — check
`SOLUTION.md` if you get stuck, but it's a full spoiler.

## Tear down

```bash
docker compose down
```
