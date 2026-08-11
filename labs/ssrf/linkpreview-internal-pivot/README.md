# LinkPreview — pivoting into the internal network

**Category:** SSRF · **Difficulty:** Medium

A link-preview feature — the same category of feature (Slack, Discord,
and plenty of internal tools all unfurl links you paste) that shows up in
SSRF reports constantly. This lab is two containers: one you can reach
directly, one you can't.

## Run it

```bash
docker compose up -d
```

The app is at **http://localhost:8082**. The second container has no
published port — that's intentional, not a bug in the lab itself.

## Your account

| Username | Password |
| --- | --- |
| `priya` | `priya123` |

## Objectives

Two flags, format `0xBugLabs{...}`. See `lab.yaml` for the full
descriptions. `SOLUTION.md` has the complete walkthrough.

## Tear down

```bash
docker compose down
```
