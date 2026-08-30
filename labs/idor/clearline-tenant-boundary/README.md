# Clearline — the tenant boundary that only exists in the browser

**Category:** Access Control / IDOR · **Difficulty:** Easy

Clearline is a multi-tenant contract workspace: several companies, one
deployment, one database. You have a normal member seat in the
**Northwind Trading** workspace.

Every identifier in the product is a UUID. There is nothing to increment,
nothing to enumerate, and no `?id=1`. That is exactly the situation where
teams decide access control is handled and stop writing the check.

## Run it

```bash
docker compose up -d
```

The app is at **http://localhost:8081**.

## Your account

| Email | Password |
| --- | --- |
| `dana@northwind.example` | `Northwind!24` |

One seat, one workspace, no admin rights. Other workspaces exist —
finding out what they hold is the exercise.

## Objectives

Two flags, format `HxBugLabs{...}`. Descriptions and progressive hints
live in `lab.yaml` and on the catalog site. `SOLUTION.md` is a full
spoiler.

## Tear down

```bash
docker compose down
```
