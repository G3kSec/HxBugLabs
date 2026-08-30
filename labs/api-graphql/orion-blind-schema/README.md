# Orion Treasury — a schema you are not allowed to read

**Category:** API / GraphQL · **Difficulty:** Hard

Orion is the treasury console a mid-sized bank gives corporate customers.
Everything the front end does goes through a single GraphQL endpoint.

- Introspection is disabled: `__schema` and `__type` return a validation
  error, not data.
- There is no schema file, no SDL, and no `.graphql` in the bundle.
- The sensitive mutation has a real rate limiter that really does lock.

The front end sends exactly two operations, ever. The endpoint answers
whatever the schema allows.

## Run it

```bash
docker compose up -d
```

The console is at **http://localhost:8086**.

## Your account

| Login | Password |
| --- | --- |
| `treasury@northgate-mills.example` | `Orion-Treasury-2026` |

Authenticate against the API directly — the console does the same thing:

```bash
curl -s -c jar -X POST http://localhost:8086/session \
  -H 'Content-Type: application/json' \
  -d '{"login":"treasury@northgate-mills.example","password":"Orion-Treasury-2026"}'

curl -s -b jar -X POST http://localhost:8086/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ viewer { id name tier accounts { id label balance } } }"}'
```

You are a `corporate` tier customer. Some things in this schema check for
a different tier.

## Objectives

Three flags, format `HxBugLabs{...}`. Objective 1 is a mapping exercise —
[clairvoyance](https://github.com/nikitastupin/clairvoyance) automates it,
and doing it by hand first teaches you why it works. Objective 2 needs a
generated request body, not a typed one. Hints are in `lab.yaml` and on
the catalog site; `SOLUTION.md` is a full spoiler.

## Tear down

```bash
docker compose down
```
