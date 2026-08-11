# Solution — Acme Attack Surface

---

## Objective 1 — Find what robots.txt was trying to hide

Start with the basics:

```
http://localhost:8084/robots.txt
```

```
User-agent: *
Disallow: /backup/
Disallow: /.git/
```

Two disallow rules, and neither path is linked from the site itself.
`Disallow` only tells well-behaved crawlers to stay out — it doesn't stop
you from requesting the path directly. The `/backup/` rule is the more
interesting one: try guessing a plausible filename for a database export
sitting in a public webroot:

```
http://localhost:8084/backup/acme-full-2026-01.sql.bak
```

```sql
-- Acme Corp full export, 2026-01-04
-- WARNING: internal use only, delete after restore testing

INSERT INTO app_config (key, value) VALUES
  ('api_key', 'sk_live_4cme_9f2c1b'),
  ('support_note', '0xBugLabs{r0b0ts_txt_1s_a_m4p_n0t_a_w4ll}');
```

**Root cause:** a deploy artifact left in the public webroot, and a
`robots.txt` that — instead of hiding it — hands out its exact location
to anyone who reads the file instead of obeying it.

---

## Objective 2 — Find the second host nothing links to

The other disallowed path, `/.git/`, is the second lead. Try the config
file directly:

```
http://localhost:8084/.git/config
```

```ini
[core]
	repositoryformatversion = 0
	filemode = true
[remote "origin"]
	url = git@github.com:acme-corp/marketing-site.git
	fetch = +refs/heads/*:refs/remotes/origin/*
[remote "legacy-deploy"]
	# old deploy target, keep until the migration is confirmed done
	url = ssh://deploy@localhost:8085/var/www/legacy-portal
[branch "main"]
	remote = origin
	merge = refs/heads/main
```

A second git remote, `legacy-deploy`, pointing at a completely different
port on the same host — `8085` — with a comment suggesting it was
supposed to be decommissioned already. Nothing on the marketing site
links to it, no port scan was needed, it's sitting right there in a
config file that should never have shipped. Try it:

```
http://localhost:8085/
```

```
Acme Legacy Portal — v0.9.2
This system was scheduled for decommission in 2024. It's still here.
0xBugLabs{f0rg0tt3n_4ss3t_st1ll_r34ch4bl3}
```

**Root cause:** an exposed `.git` directory doesn't just leak source —
its config often leaks infrastructure: old deploy targets, internal
hostnames, credentials in remote URLs. This is exactly how real
attack-surface-mapping engagements find the asset nobody remembered to
decommission: not a scanner, a leftover reference in a file that was
never meant to be public in the first place.
