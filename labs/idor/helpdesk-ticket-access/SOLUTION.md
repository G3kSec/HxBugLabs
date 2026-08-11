# Solution — Acme HelpDesk

Full walkthrough. Stop reading after each objective if you want to keep
working the next one yourself.

---

## Objective 1 — Read another customer's ticket

Log in as `alice` / `alice123` and open **My tickets**. Alice owns tickets
`#1` and `#2` — both linked from the dashboard, both load fine at
`/tickets/1` and `/tickets/2`.

The ticket ID in that URL is just an incrementing integer with nothing tying
it to whoever's logged in. Try adjacent IDs directly:

```
GET /tickets/3
```

This loads — no 403, no redirect — and it's Bob's ticket, not Alice's. Bob
pasted what he thought was a private backup verification code into the
ticket body:

```
0xBugLabs{h0riz0nt4l_1d0r_1s_st1ll_a_bug}
```

**Root cause:** `GET /tickets/:id` in `server.js` loads whichever ticket
matches the ID and renders it — it never checks that
`ticket.ownerId === req.session.userId`. Classic horizontal IDOR: the
authorization check that should exist per-record just isn't there.

---

## Objective 2 — Reach the internal agent console

Nothing in Alice's UI links to a staff view — no nav item, no button. But
the app is a support portal; a staff/agent view is a reasonable guess for
what else exists. Try the obvious path:

```
GET /agent/dashboard
```

Still logged in as Alice — a plain customer account — this loads the full
internal queue: every customer's tickets, plus an "Internal notes" section
that customers were never meant to see, including:

```
0xBugLabs{v3rt1c4l_4cc3ss_c0ntr0l_m1ss1ng}
```

**Root cause:** `server.js` defines a `requireAgent` middleware that checks
`user.role === "agent"` — but the `/agent/dashboard` route only has
`requireAuth` applied, not `requireAgent`. The check exists in the
codebase; it just isn't wired onto the route that needs it. This is
"missing function level access control" (OWASP A01) — one of the most
commonly reported broken-access-control patterns in real bug bounty
reports, and usually found exactly this way: by guessing plausible
staff/admin paths on an app that clearly has a staff/admin side, and just
trying them while authenticated as a low-privileged user.

---

## Takeaway

Two different flavors of the same root problem — trusting the UI (or a
sequential ID) to gate access, instead of re-checking authorization on
every request, server-side, per record and per route.
