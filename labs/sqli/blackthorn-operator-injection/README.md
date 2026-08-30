# Blackthorn ATS — the query you were allowed to write

**Category:** SQL / NoSQL Injection · **Difficulty:** Medium

Blackthorn is an applicant tracking system on a document database. The
login form was hardened after a pentest: both fields are coerced to
strings before they reach the query, and you can confirm that yourself in
one request.

Two other endpoints take a JSON body and pass its values into the same
query engine untouched.

## Run it

```bash
docker compose up -d
```

The API is at **http://localhost:8090** (open it in a browser for the
route list and the saved-search filter format).

## Your account

| Email | Password |
| --- | --- |
| `t.vidal@blackthorn.example` | `Blackthorn-ATS-2026` |

A plain recruiter seat.

```bash
curl -s -c jar -X POST http://localhost:8090/api/session \
  -H 'Content-Type: application/json' \
  -d '{"email":"t.vidal@blackthorn.example","password":"Blackthorn-ATS-2026"}'
```

## About the database

The store is a small in-process query engine implementing the subset of
MongoDB's operators the ATS uses (`$eq`, `$ne`, `$gt`, `$in`, `$regex`,
`$exists`, `$or`, …). It is written into the lab so the whole thing runs
in one container instead of shipping a database image.

The behaviour that matters is identical to a real driver: a filter is a
plain object, operators are keys beginning with `$`, and whatever the
caller puts in the filter is what gets evaluated. Everything you learn
here applies unchanged against Mongoose, the Node driver, or any other
document store with a JSON query language.

## Objectives

Two flags, format `HxBugLabs{...}`. The second needs a script — a few
hundred requests, not a few. Hints are in `lab.yaml` and on the catalog
site; `SOLUTION.md` is a full spoiler.

## Tear down

```bash
docker compose down
```
