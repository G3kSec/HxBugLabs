const crypto = require("crypto");

function b64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function sign(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const headerPart = b64url(JSON.stringify(header));
  const payloadPart = b64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${headerPart}.${payloadPart}.${signature}`;
}

/**
 * The bug lives here. A correct implementation hardcodes the expected
 * algorithm and rejects anything else. This one trusts the `alg` field
 * inside the token to decide HOW to verify itself — so a token that
 * claims alg:"none" skips verification entirely. This is a real,
 * repeatedly-found CVE-class bug across multiple JWT libraries' early
 * implementations, not an invented toy flaw.
 */
function verify(token, secret) {
  const parts = token.split(".");
  if (parts.length < 2) throw new Error("Malformed token");

  const [headerPart, payloadPart, signaturePart] = parts;
  const header = JSON.parse(b64urlDecode(headerPart));
  const payload = JSON.parse(b64urlDecode(payloadPart));

  if (header.alg === "none") {
    return payload; // no signature check at all
  }

  if (header.alg !== "HS256") {
    throw new Error(`Unsupported alg: ${header.alg}`);
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const actual = signaturePart || "";
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(actual);

  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    throw new Error("Invalid signature");
  }

  return payload;
}

module.exports = { sign, verify };
