"""
Validates every labs/**/lab.yaml against data/taxonomy.yaml.

Mirrors the discipline from 0xBugLetter's validator: one script, no
dependencies beyond pyyaml, fails loudly with the exact file and field
that's wrong.

Usage:
    python scripts/validate.py
"""

import re
import sys
from pathlib import Path

import yaml

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REPO_ROOT = Path(__file__).resolve().parents[1]
LABS_DIR = REPO_ROOT / "labs"
TAXONOMY_FILE = REPO_ROOT / "data" / "taxonomy.yaml"

FLAG_RE = re.compile(r"^0xBugLabs\{.+\}$")
SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

errors: list[str] = []


def error(where: str, message: str) -> None:
    errors.append(f"{where}: {message}")


def load_taxonomy() -> dict:
    with open(TAXONOMY_FILE, encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def check_str(where: str, data: dict, key: str, required: bool = True) -> str | None:
    value = data.get(key)
    if value is None:
        if required:
            error(where, f'missing required field "{key}"')
        return None
    if not isinstance(value, str) or not value.strip():
        error(where, f'"{key}" has to be a non-empty string')
        return None
    return value.strip()


def validate_lab(path: Path, taxonomy: dict, seen_flags: dict[str, str], seen_ports: dict[int, str]) -> None:
    where = str(path.relative_to(REPO_ROOT))
    lab_dir = path.parent

    try:
        with open(path, encoding="utf-8") as handle:
            data = yaml.safe_load(handle)
    except yaml.YAMLError as exc:
        error(where, f"invalid YAML — {exc}")
        return

    if not isinstance(data, dict):
        error(where, "file must contain a YAML object")
        return

    check_str(where, data, "title")

    slug = check_str(where, data, "slug")
    if slug and not SLUG_RE.match(slug):
        error(where, f'"slug" has to be lowercase-with-hyphens (got "{slug}")')
    if slug and slug != lab_dir.name:
        error(where, f'"slug" ("{slug}") has to match the folder name ("{lab_dir.name}")')

    category = check_str(where, data, "category")
    if category and category not in taxonomy["categories"]:
        error(where, f'"category" = "{category}" is not in data/taxonomy.yaml')
    if category:
        expected_category_dir = lab_dir.parent.name
        # Folder-name slug of the category, e.g. "Access Control / IDOR" -> "idor"
        # is intentionally loose here — just confirm the lab sits under *a*
        # category directory, exact slug mapping is eyeballed at review time.

    difficulty = check_str(where, data, "difficulty")
    if difficulty and difficulty not in taxonomy["difficulties"]:
        error(where, f'"difficulty" = "{difficulty}" is not in data/taxonomy.yaml')

    tech = data.get("tech")
    if not isinstance(tech, list) or not tech or not all(isinstance(t, str) for t in tech):
        error(where, '"tech" has to be a non-empty list of strings')

    port = data.get("port")
    if not isinstance(port, int) or isinstance(port, bool) or not (1024 <= port <= 65535):
        error(where, '"port" has to be an integer between 1024 and 65535')
    elif port in seen_ports:
        error(where, f'"port" {port} is already used by {seen_ports[port]}')
    else:
        seen_ports[port] = where

    check_str(where, data, "description")

    objectives = data.get("objectives")
    if not isinstance(objectives, list) or not objectives:
        error(where, '"objectives" has to be a non-empty list — every lab needs at least one')
        objectives = []

    seen_objective_ids: set[str] = set()
    for index, obj in enumerate(objectives):
        obj_where = f"{where}[objectives][{index}]"
        if not isinstance(obj, dict):
            error(obj_where, "each objective has to be an object")
            continue

        obj_id = check_str(obj_where, obj, "id")
        if obj_id:
            if not SLUG_RE.match(obj_id):
                error(obj_where, f'"id" has to be lowercase-with-hyphens (got "{obj_id}")')
            if obj_id in seen_objective_ids:
                error(obj_where, f'duplicate objective id "{obj_id}" within this lab')
            seen_objective_ids.add(obj_id)

        check_str(obj_where, obj, "title")
        check_str(obj_where, obj, "description")

        flag = check_str(obj_where, obj, "flag")
        if flag:
            if not FLAG_RE.match(flag):
                error(obj_where, f'"flag" has to match 0xBugLabs{{...}} (got "{flag}")')
            elif flag in seen_flags:
                error(obj_where, f'flag is a duplicate of the one in {seen_flags[flag]} — flags must be unique repo-wide')
            else:
                seen_flags[flag] = obj_where

        # Optional: progressive nudges shown behind a collapsed section on
        # the site, so someone can opt into a push without opening
        # SOLUTION.md and seeing the full answer.
        hints = obj.get("hints")
        if hints is not None:
            if not isinstance(hints, list) or not hints or not all(
                isinstance(h, str) and h.strip() for h in hints
            ):
                error(obj_where, '"hints" has to be a non-empty list of non-empty strings')

    tags = data.get("tags")
    if tags is not None and (not isinstance(tags, list) or not all(isinstance(t, str) for t in tags)):
        error(where, '"tags" has to be a list of strings')

    for required_file in ("docker-compose.yml", "README.md", "SOLUTION.md"):
        if not (lab_dir / required_file).exists():
            error(where, f"missing {required_file} next to lab.yaml")

    # A single-service lab has its Dockerfile right next to lab.yaml.
    # Multi-service labs (docker-compose.yml with multiple `build:`
    # entries) put each one in its own subfolder instead — either is
    # fine, but at least one Dockerfile has to exist somewhere in the lab.
    if not list(lab_dir.glob("**/Dockerfile")):
        error(where, "no Dockerfile found anywhere under this lab")


def main() -> int:
    taxonomy = load_taxonomy()
    seen_flags: dict[str, str] = {}
    seen_ports: dict[int, str] = {}

    lab_files = sorted(LABS_DIR.glob("*/*/lab.yaml")) if LABS_DIR.exists() else []
    for path in lab_files:
        validate_lab(path, taxonomy, seen_flags, seen_ports)

    print(f"Validated {len(lab_files)} lab(s).\n")

    if errors:
        for message in errors:
            print(f"[FAIL] {message}")
        print(f"\n{len(errors)} error(s).")
        return 1

    print("All labs valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
