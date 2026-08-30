# Atrium — an avatar pipeline that trusts the file name

**Category:** File Upload · **Difficulty:** Easy

Atrium is a staff directory. Everyone uploads a profile picture, and the
upload endpoint does check what it receives: the extension against an
allow-list, the size against a cap, and it strips the uploaded name down
to a leaf so a path cannot come in through it.

Try `shell.php` and watch it get refused. Then look at what the endpoint
does with everything that passes.

## Run it

```bash
docker compose up -d
```

The directory is at **http://localhost:8091**.

## Your account

| Email | Password |
| --- | --- |
| `n.aaberg@atrium.example` | `Atrium-Directory-2026` |

```bash
curl -s -c jar -X POST http://localhost:8091/api/session \
  -H 'Content-Type: application/json' \
  -d '{"email":"n.aaberg@atrium.example","password":"Atrium-Directory-2026"}'

curl -s -b jar -F "avatar=@picture.png" http://localhost:8091/api/avatar
```

## The API

```
POST /api/session                     {"email": "...", "password": "..."}
POST /api/avatar[?folder=<team>]      multipart/form-data, field name "avatar"
GET  /api/staff
GET  /api/uploads/audit               what the platform team's audit job reports
```

Uploads are served from `/uploads/` on this same origin.

## Objectives

Two flags, format `HxBugLabs{...}`, both reported by
`GET /api/uploads/audit` once the condition is met. Hints are in
`lab.yaml` and on the catalog site; `SOLUTION.md` is a full spoiler.

Everything you write stays inside the container. `docker compose down &&
docker compose up -d --build` gives you a clean instance.

## Tear down

```bash
docker compose down
```
