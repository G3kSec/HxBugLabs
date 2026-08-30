const http = require("node:http");

/**
 * Harbor's caching edge.
 *
 * Policy, as written in the runbook:
 *   - static assets are always cached, decided by the file extension.
 *     They carry no user data, so cookies on the request are irrelevant
 *     and are ignored when deciding.
 *   - the public marketing pages are cached too, but only for requests
 *     that arrive without a session cookie, so a signed-in view can never
 *     be stored.
 *   - everything else is proxied straight through.
 *   - the cache is shared, so entries are keyed by method and URL.
 */

const PORT = Number(process.env.PORT || 8087);
const ORIGIN = new URL(process.env.ORIGIN_URL || "http://127.0.0.1:8080");
const TTL_MS = Number(process.env.CACHE_TTL_MS || 60_000);

/* Pages with no per-user content. Cached to keep the origin off the
   critical path for anonymous traffic. */
const CACHEABLE_PAGES = new Set(["/", "/status"]);

const STATIC_EXTENSIONS = new Set([
  "css", "js", "mjs", "map", "png", "jpg", "jpeg", "gif", "svg", "ico",
  "webp", "woff", "woff2", "ttf", "eot", "avif",
]);

/* Headers that describe the client rather than the resource. They are
   forwarded so the origin can build correct links, and they are not part
   of the key — the key is the URL, the way a shared cache should work. */
const FORWARDED_HEADERS = ["x-forwarded-host", "x-forwarded-proto", "x-forwarded-for"];

const cache = new Map();

function extensionOf(pathname) {
  const lastSegment = pathname.split("/").pop() || "";
  const dot = lastSegment.lastIndexOf(".");
  if (dot <= 0) return null;
  return lastSegment.slice(dot + 1).toLowerCase();
}

function hasSessionCookie(req) {
  return /connect\.sid=/.test(String(req.headers.cookie || ""));
}

function isCacheable(req, url) {
  if (req.method !== "GET") return false;

  const extension = extensionOf(url.pathname);
  if (extension !== null && STATIC_EXTENSIONS.has(extension)) return true;

  return CACHEABLE_PAGES.has(url.pathname) && !hasSessionCookie(req);
}

function cacheKey(req, url) {
  return `${req.method} ${url.pathname}${url.search}`;
}

function proxy(req, res, url, onResponse) {
  const headers = { ...req.headers, host: ORIGIN.host };
  for (const name of FORWARDED_HEADERS) {
    if (req.headers[name]) headers[name] = req.headers[name];
  }

  const upstream = http.request(
    {
      hostname: ORIGIN.hostname,
      port: ORIGIN.port || 80,
      path: url.pathname + url.search,
      method: req.method,
      headers,
    },
    (originRes) => {
      const chunks = [];
      originRes.on("data", (chunk) => chunks.push(chunk));
      originRes.on("end", () =>
        onResponse({
          status: originRes.statusCode,
          headers: originRes.headers,
          body: Buffer.concat(chunks),
        }),
      );
    },
  );

  upstream.on("error", () => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("origin unreachable");
  });

  req.pipe(upstream);
}

function send(res, response, cacheState) {
  const headers = { ...response.headers };
  delete headers["transfer-encoding"];
  delete headers["content-length"];
  headers["x-harbor-cache"] = cacheState;

  res.writeHead(response.status, headers);
  res.end(response.body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "harbor.local"}`);

  /* Operational visibility: what the edge is currently holding. Read-only
     and deliberately exposed in every environment so support can answer
     "why am I seeing a stale page" without opening a ticket. */
  if (url.pathname === "/_cache/status") {
    const entries = [...cache.entries()].map(([key, value]) => ({
      key,
      storedAt: new Date(value.storedAt).toISOString(),
      expiresInMs: Math.max(0, value.storedAt + TTL_MS - Date.now()),
      status: value.response.status,
      contentType: value.response.headers["content-type"] || "",
      bytes: value.response.body.length,
    }));
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ttlMs: TTL_MS, count: entries.length, entries }, null, 2));
  }

  if (url.pathname === "/_cache/flush") {
    cache.clear();
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("flushed");
  }

  if (!isCacheable(req, url)) {
    return proxy(req, res, url, (response) => send(res, response, "BYPASS"));
  }

  const key = cacheKey(req, url);
  const hit = cache.get(key);

  if (hit && Date.now() - hit.storedAt < TTL_MS) {
    return send(res, hit.response, "HIT");
  }

  proxy(req, res, url, (response) => {
    if (response.status === 200) {
      cache.set(key, { storedAt: Date.now(), response });
    }
    send(res, response, "MISS");
  });
});

server.listen(PORT, () => console.log(`Harbor edge listening on :${PORT} -> ${ORIGIN.href}`));
