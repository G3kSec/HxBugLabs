# Solution — LinkPreview

---

## Objective 1 — Reach the internal service

Log in as `priya` / `priya123`. The **Preview** feature fetches whatever
URL you give it server-side and shows you a snippet — try feeding it
something it clearly shouldn't reach:

```
http://localhost:8082/preview
url = http://127.0.0.1:8082/
```

Blocked: *"That host isn't allowed."* The app has a denylist for the
obvious self-referential hosts (`localhost`, `127.0.0.1`, `0.0.0.0`,
`::1`, `169.254.x.x`). That's a denylist, though — it only blocks what its
author thought to block.

Check **System status** — a leftover internal dashboard listing service
names: `linkpreview`, `auth-provider`, `warehouse-api`,
`billing-gateway`. In a Docker Compose network, service names resolve as
hostnames. None of those names match the denylist. Try it:

```
url = http://warehouse-api:9000/
```

This isn't on the denylist, so the app fetches it — and gets an answer
from a container that has no exposed port at all, reachable only because
`linkpreview` fetched it on your behalf:

```
Warehouse Inventory API — internal use only
status: operational
note: 0xBugLabs{ssrf_r34ch3d_th3_1nt3rn4l_n3tw0rk}
```

**Root cause:** the SSRF guard is a denylist of well-known
self-referential addresses, not an allowlist of approved destinations.
Anything with a different hostname — including services that only exist
inside this Docker network — sails through.

---

## Objective 2 — Find what it doesn't advertise

The root of `warehouse-api` is one route. A real internal service
usually has more than one, and nothing forces the interesting one to be
`/`. Try common internal-tooling paths through the same preview feature:

```
url = http://warehouse-api:9000/internal/config
```

```json
{
  "service": "warehouse-api",
  "deploy_key": "wh_live_9f2c...redacted-in-real-life",
  "flag": "0xBugLabs{ssrf_p1v0t_t0_hidd3n_3ndp0int}",
  ...
}
```

**Root cause:** same SSRF, but the takeaway is different — reaching an
internal service once is rarely the end of the finding. Internal services
routinely skip auth entirely on the assumption that network position is
the security boundary ("nothing outside can reach this, so why bother").
SSRF breaks that assumption completely: once you can make requests from
inside the network, every route on that internal service is in scope, not
just the one you happened to try first.
