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
- **Egress isolation, where it's used, is deliberate — not the default.**
  `internal: true` on a Compose network blocks that network's containers
  from reaching the internet, but it *also* blocks Docker from publishing
  ports to the host through it (confirmed by hand: a single-service lab
  network with `internal: true` made the app completely unreachable from
  `localhost`, port binding silently empty). So single-service labs use
  Compose's plain default network — there's nothing in a toy app's own code
  that calls out, so there's nothing to isolate at the network layer.
  Multi-service labs (e.g. an SSRF lab with a "vulnerable app" + an
  "internal-only backend") *do* put the internal-only service on its own
  `internal: true` network that only the exposed service can reach — that's
  the case the flag is actually for: a service that must stay unreachable
  from the host on purpose, not "block outbound internet."
- **Tear down when done.** `docker compose down -v` after each session
  rather than leaving vulnerable containers running indefinitely.

## Reporting a problem with this repo itself

This is a private, single-maintainer repo for now. If that changes, this
section will too.
