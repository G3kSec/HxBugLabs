# NoteShare — from reflected XSS to admin takeover

**Category:** XSS · **Difficulty:** Medium

A shared-notes app with a support workflow: report a link, and a real
support bot (a headless browser, logged in as an actual admin) visits it to
review your report.

## Run it

```bash
docker compose up -d
```

The app is at **http://localhost:8081**. First build takes a bit longer
than usual — it installs Chromium for the support bot.

## Your account

| Username | Password |
| --- | --- |
| `mallory` | `mallory123` |

There's also an `admin` account. You don't have its password, and it's not
meant to be guessable — you're meant to take its session, not its
credentials.

## Objectives

Two flags, format `0xBugLabs{...}`. See `lab.yaml` for the full
descriptions. `SOLUTION.md` has the complete walkthrough if you get stuck.

## Tear down

```bash
docker compose down
```
