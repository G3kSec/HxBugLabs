/**
 * Mosaic comment sanitizer.
 *
 * Allow-list based: a tag survives only if it is in TAGS, an attribute
 * only if it is in ATTRS for that tag, and a URL only if its scheme is in
 * SCHEMES. Anything else is dropped. Written in-house in 2023, after a
 * DOMPurify upgrade broke the incident timeline layout.
 */

const TAGS = new Set([
  "b", "strong", "i", "em", "u", "code", "pre", "p", "br",
  "ul", "ol", "li", "a", "img", "blockquote",
]);

const ATTRS = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  "*": new Set(["title", "class"]),
};

const SCHEMES = new Set(["http:", "https:", "mailto:"]);

const ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&nbsp;": " ",
};

/* Values arrive entity-encoded from browsers and from our own editor, so
   they are decoded before inspection -- otherwise "&#106;avascript:"
   walks straight past the scheme check below. */
function decodeEntities(value) {
  return value.replace(/&(?:[a-zA-Z]+|#\d+);/g, (match) => {
    const lower = match.toLowerCase();
    if (ENTITIES[lower] !== undefined) return ENTITIES[lower];
    const numeric = /^&#(\d+);$/.exec(match);
    if (numeric) return String.fromCharCode(Number(numeric[1]));
    return match;
  });
}

function schemeAllowed(value) {
  const trimmed = value.replace(/\s/g, "");
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    const scheme = trimmed.slice(0, trimmed.indexOf(":") + 1).toLowerCase();
    return SCHEMES.has(scheme);
  }
  return true; // relative URL
}

function attributesFor(tag, raw) {
  const allowed = [];
  const attrPattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

  let match;
  while ((match = attrPattern.exec(raw)) !== null) {
    const name = match[1].toLowerCase();
    const rawValue =
      match[3] !== undefined ? match[3] : match[4] !== undefined ? match[4] : match[5] || "";
    const value = decodeEntities(rawValue);

    const permitted = (ATTRS[tag] && ATTRS[tag].has(name)) || ATTRS["*"].has(name);
    if (!permitted) continue;
    if (name.startsWith("on")) continue;
    if ((name === "href" || name === "src") && !schemeAllowed(value)) continue;

    allowed.push({ name, value });
  }
  return allowed;
}

/**
 * Rebuilds the tag from the attributes that survived, so nothing in the
 * original markup reaches the page untouched.
 */
function serializeTag(tag, attrs, selfClosing) {
  const rendered = attrs.map((a) => " " + a.name + '="' + a.value + '"').join("");
  return "<" + tag + rendered + (selfClosing ? " /" : "") + ">";
}

function escapeText(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sanitize(input) {
  const source = String(input == null ? "" : input);
  const out = [];
  const tokenPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)\/?>/g;

  let cursor = 0;
  let match;
  while ((match = tokenPattern.exec(source)) !== null) {
    out.push(escapeText(source.slice(cursor, match.index)));
    cursor = tokenPattern.lastIndex;

    const tag = match[1].toLowerCase();
    const closing = match[0].charAt(1) === "/";

    if (!TAGS.has(tag)) continue;

    if (closing) {
      out.push("</" + tag + ">");
      continue;
    }

    const selfClosing = tag === "br" || tag === "img";
    out.push(serializeTag(tag, attributesFor(tag, match[2] || ""), selfClosing));
  }

  out.push(escapeText(source.slice(cursor)));
  return out.join("");
}

module.exports = { sanitize };
