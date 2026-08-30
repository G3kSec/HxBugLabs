# Mosaic Status — the sanitizer that rebuilt what it cleaned

**Category:** XSS · **Difficulty:** Hard

Mosaic runs the public status page for a payments company. Customers can
comment on incidents with light formatting, so comments go through a
sanitizer: allow-list based, written in-house, and it does reject `<script>`,
`onerror=`, and `javascript:` URLs. You can verify all three yourself in
the first two minutes.

There is also a content security policy with no `unsafe-inline`, so an
event handler would not execute even if one survived.

Both controls are real. Neither is looking at the place where the payload
gets built.

## Run it

```bash
docker compose up -d
```

The status page is at **http://localhost:8085**. The image installs
Chromium, so the first build takes a few minutes.

## Your account

| Username | Password |
| --- | --- |
| `kellan` | `mosaic-status-2026` |

A customer account. It can comment on incidents and report a comment to
the on-call engineer.

## What the "Report to on-call" button does

It launches a **real headless Chromium**, signs it in as the on-call
engineer (`oncall`, an account you do not have the password for), and
opens the incident page — same CSP, same rendering, no shortcuts. If your
comment runs script, it runs inside a session holding the engineer role.

The engineer's session cookie is `HttpOnly`. That is deliberate, and it
matters less than people expect.

## Instrumentation

Two endpoints exist so you can prove your own success without an external
listener:

```
GET|POST /api/collect       records whatever you send it
GET      /api/collect/log   what it has recorded (needs your session)
GET      /api/canary?build= answers only to the build id of this instance
```

## Objectives

Two flags, format `HxBugLabs{...}`. Hints are in `lab.yaml` and on the
catalog site. `SOLUTION.md` is a full spoiler.

## Tear down

```bash
docker compose down
```
