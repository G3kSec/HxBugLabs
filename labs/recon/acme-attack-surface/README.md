# Acme Attack Surface — mapping what's actually reachable

**Category:** Recon / OSINT · **Difficulty:** Easy

No login form, no input field, no obvious bug to poke at — just a small
company's public marketing site, exactly as it ships. This lab is about
everything *around* the app: what got left in the webroot, and what else
is running that nobody bothered to hide properly.

## Run it

```bash
docker compose up -d
```

The marketing site is at **http://localhost:8084**. There's a second
service in this lab too — you won't find a link to it anywhere on the
site. Finding it is the point.

## Objectives

Two flags, format `0xBugLabs{...}`. See `lab.yaml` for the full
descriptions. `SOLUTION.md` has the complete walkthrough.

## Tear down

```bash
docker compose down
```
