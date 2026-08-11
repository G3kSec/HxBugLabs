# Meridian — two ways to break authentication

**Category:** Auth · **Difficulty:** Medium

A small customer banking portal. Two independent authentication bugs live
here — solving one doesn't require or help with the other.

## Run it

```bash
docker compose up -d
```

The app is at **http://localhost:8083**.

## Your account

| Username | Password |
| --- | --- |
| `alice` | `alice123` |

There's also `bob` (another customer) and `admin`. You don't have either
of their passwords, and they're not guessable — both objectives are about
not needing them.

## Objectives

Two flags, format `0xBugLabs{...}`. See `lab.yaml` for the full
descriptions. `SOLUTION.md` has the complete walkthrough.

## Tear down

```bash
docker compose down
```
