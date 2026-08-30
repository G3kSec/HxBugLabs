# Quill — the allow-list that read the wrong side of the @

**Category:** SSRF · **Difficulty:** Medium

Quill is a docs platform for engineering teams. Spaces have outbound
webhooks: register a URL and Quill POSTs to it whenever a page changes.
The delivery log shows you the full response from your endpoint, so you
can debug an integration without leaving the product.

Someone did think about SSRF here. There is an allow-list, it rejects
internal hostnames, and you can watch it reject them. It is still wrong.

## Run it

```bash
docker compose up -d
```

The app is at **http://localhost:8083**.

## Your account

| Email | Password |
| --- | --- |
| `tobias@lumenworks.example` | `Quill-Docs-2026` |

## What's behind it

Three containers. Only Quill is published to your host; the other two sit
on a Docker network marked `internal: true` and have no route to your
machine at all. Reaching them means making Quill do it for you — which is
the entire exercise.

One of them stands in for the cloud instance metadata service. On a real
instance that answers on `169.254.169.254`; Docker will not assign a
container an address in the link-local range, so here it has a name on
the internal network instead. **The paths are the real ones**, so the
technique transfers unchanged.

## Objectives

Two flags, format `HxBugLabs{...}`. Hints are in `lab.yaml` and on the
catalog site. `SOLUTION.md` is a full spoiler.

## Tear down

```bash
docker compose down
```
