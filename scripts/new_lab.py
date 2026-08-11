"""
Scaffolds a new lab folder: docker-compose.yml, Dockerfile, lab.yaml,
README.md, SOLUTION.md, and a minimal Node/Express server.js to start from.

Usage:
    python scripts/new_lab.py idor another-ticket-bug --title "Another ticket bug" --difficulty Easy

Run scripts/validate.py afterward — the generated lab.yaml is deliberately
incomplete (empty objectives list, placeholder description) and won't pass
until you fill it in.
"""

import argparse
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LABS_DIR = REPO_ROOT / "labs"

# Category folder slugs, kept as an explicit map rather than auto-slugified
# — several category names contain "/", and there are only 18 of them, so
# a fixed lookup is more predictable than a generic slugify function.
CATEGORY_DIRS = {
    "SQL / NoSQL Injection": "sqli",
    "Command Injection": "command-injection",
    "XSS": "xss",
    "SSRF": "ssrf",
    "CSRF": "csrf",
    "XXE": "xxe",
    "SSTI": "ssti",
    "Access Control / IDOR": "idor",
    "Auth": "auth",
    "File Upload": "file-upload",
    "Deserialization": "deserialization",
    "Race Condition": "race-condition",
    "Business Logic": "business-logic",
    "API / GraphQL": "api-graphql",
    "Cache Poisoning": "cache-poisoning",
    "Request Smuggling": "request-smuggling",
    "Prototype Pollution": "prototype-pollution",
    "Recon / OSINT": "recon",
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Scaffold a new 0xBugLabs lab")
    parser.add_argument("category_dir", choices=sorted(CATEGORY_DIRS.values()), help="category folder, e.g. idor")
    parser.add_argument("slug", help="lab folder name, lowercase-with-hyphens")
    parser.add_argument("--title", default=None, help="human-readable title (defaults to slug)")
    parser.add_argument("--difficulty", default="Easy", choices=["Easy", "Medium", "Hard"])
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()

    category = next(k for k, v in CATEGORY_DIRS.items() if v == args.category_dir)
    title = args.title or args.slug.replace("-", " ").title()
    lab_dir = LABS_DIR / args.category_dir / args.slug

    if lab_dir.exists():
        raise SystemExit(f"{lab_dir} already exists.")

    lab_dir.mkdir(parents=True)

    (lab_dir / "lab.yaml").write_text(
        f"""title: "{title}"
slug: "{args.slug}"
category: "{category}"
difficulty: "{args.difficulty}"
tech: ["Node.js", "Express"]
port: {args.port}

description: >-
  TODO: one paragraph, scene-setting like a real program scope.

objectives:
  - id: "TODO"
    title: "TODO"
    description: >-
      TODO
    flag: "0xBugLabs{{TODO}}"

tags:
  - "TODO"
""",
        encoding="utf-8",
    )

    (lab_dir / "docker-compose.yml").write_text(
        f"""services:
  {args.slug}:
    build: .
    container_name: 0xbuglabs-{args.slug}
    ports:
      - "{args.port}:{args.port}"
    restart: unless-stopped

# Multi-service lab where one container must stay unreachable from the
# host on purpose (e.g. an SSRF target)? Give THAT service its own
# internal-only network — see SECURITY.md for why `internal: true` on a
# lab's main published service breaks port publishing entirely.
""",
        encoding="utf-8",
    )

    (lab_dir / "Dockerfile").write_text(
        f"""FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js ./

RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE {args.port}
CMD ["node", "server.js"]
""",
        encoding="utf-8",
    )

    (lab_dir / "package.json").write_text(
        f"""{{
  "name": "{args.slug}",
  "version": "1.0.0",
  "private": true,
  "main": "server.js",
  "dependencies": {{
    "express": "^4.19.2"
  }}
}}
""",
        encoding="utf-8",
    )

    (lab_dir / "server.js").write_text(
        f"""const express = require("express");
const app = express();
const PORT = process.env.PORT || {args.port};

app.get("/", (req, res) => {{
  res.send("TODO — replace with the real lab app.");
}});

app.listen(PORT, () => console.log(`{args.slug} listening on :${{PORT}}`));
""",
        encoding="utf-8",
    )

    (lab_dir / "README.md").write_text(
        f"""# {title}

**Category:** {category} · **Difficulty:** {args.difficulty}

TODO: scene-setting description, no spoilers.

## Run it

```bash
docker compose up -d
```

The app is at **http://localhost:{args.port}**.

## Objectives

TODO — see `lab.yaml`.

## Tear down

```bash
docker compose down
```
""",
        encoding="utf-8",
    )

    (lab_dir / "SOLUTION.md").write_text(
        f"""# Solution — {title}

TODO: full walkthrough, one section per objective, root cause explained
at the end of each.
""",
        encoding="utf-8",
    )

    print(f"Scaffolded {lab_dir.relative_to(REPO_ROOT)}")
    print("Fill in lab.yaml, server.js, README.md, SOLUTION.md, then:")
    print("  python scripts/validate.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
