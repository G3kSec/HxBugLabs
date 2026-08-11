# Security notes

Every lab in this repo is **deliberately vulnerable**. That's the entire
point — treat every container here as hostile.

## Rules

- **`localhost` only.** Never bind a lab's ports to `0.0.0.0` on a machine
  reachable from the internet or an untrusted network. Docker Compose's
  default port mappings already bind to your host's interfaces — don't add
  a reverse proxy or port-forward that exposes them further.
- **Don't run labs on a machine that holds anything sensitive.** These are
  intentionally broken apps; a container escape or an unrelated bug in the
  vulnerable app itself is not a scenario to defend against, it's assumed
  possible.
- **`internal: true` networking by default** where a lab has no reason to
  reach the internet. Opt out per lab if a specific scenario genuinely
  needs egress (documented in that lab's `README.md` when it applies), not
  the other way around.
- **Tear down when done.** `docker compose down -v` after each session
  rather than leaving vulnerable containers running indefinitely.

## Reporting a problem with this repo itself

This is a private, single-maintainer repo for now. If that changes, this
section will too.
