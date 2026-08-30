# Vega Freight — what the build pipeline left behind

**Category:** Recon / OSINT · **Difficulty:** Easy

Vega Freight runs a public shipment-tracking portal. Your scope is one
hostname. No test account, no API documentation, no Swagger UI, no
`/graphql` to introspect — the same thing you get handed on half the
programs worth working.

Everything you need is already being served. The job is noticing it.

## Run it

```bash
docker compose up -d
```

The portal is at **http://localhost:8080**.

## Scope

`vega-freight.local` and anything the same process answers for. The app
is a single container — treat `http://localhost:8080` as the IP behind
the DNS name, exactly like a real engagement where you resolve the host
once and then work against the address.

## Your account

None. That's the point.

## Objectives

Two flags, format `HxBugLabs{...}`. Descriptions and progressive hints
are in `lab.yaml` (and on the catalog site). `SOLUTION.md` is a full
spoiler.

## Tear down

```bash
docker compose down
```
