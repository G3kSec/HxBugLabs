import fs from "node:fs";
import path from "node:path";
import { load as loadYaml } from "js-yaml";

import {
  CATEGORIES,
  DIFFICULTIES,
  type Category,
  type Difficulty,
  type Lab,
  type LabObjective,
} from "./types";

/**
 * `labs/` and `data/` live at the repo root, one level above `web/`.
 * Resolved from cwd because both `next dev` and `next build` run from
 * `web/`.
 */
const REPO_ROOT = path.join(process.cwd(), "..");
const LABS_DIR = path.join(REPO_ROOT, "labs");
const DATA_DIR = path.join(REPO_ROOT, "data");

/**
 * Content is read once and cached in production builds. In dev, Next
 * doesn't watch `../labs`, so caching would mean restarting the server on
 * every YAML edit — re-reading a handful of files per request costs nothing.
 */
const CACHE_ENABLED = process.env.NODE_ENV !== "development";

/* ── Validation helpers ─────────────────────────────────────────────────
   Fail loudly at build time before rendering corrupt data. The message
   always names the file, so whoever opened the PR can fix it without
   reading this code. */

function fail(file: string, message: string): never {
  throw new Error(`[0xBugLabs] ${file}: ${message}`);
}

type RawRecord = Record<string, unknown>;

function requireString(file: string, obj: RawRecord, key: string): string {
  const value = obj[key];
  if (typeof value !== "string" || value.trim() === "") {
    fail(file, `missing required field "${key}" (string)`);
  }
  return value.trim();
}

function requireEnum<T extends string>(
  file: string,
  obj: RawRecord,
  key: string,
  allowed: readonly T[],
): T {
  const value = requireString(file, obj, key);
  if (!allowed.includes(value as T)) {
    fail(file, `"${key}" = "${value}" is not valid. Allowed: ${allowed.join(", ")}`);
  }
  return value as T;
}

function requireStringArray(file: string, obj: RawRecord, key: string): string[] {
  const value = obj[key];
  if (!Array.isArray(value) || value.length === 0 || !value.every((v) => typeof v === "string")) {
    fail(file, `"${key}" has to be a non-empty list of strings`);
  }
  return value as string[];
}

function optionalStringArray(file: string, obj: RawRecord, key: string): string[] {
  const value = obj[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    fail(file, `"${key}" has to be a list of strings`);
  }
  return value as string[];
}

function optionalNonEmptyStringArray(file: string, obj: RawRecord, key: string): string[] {
  const value = obj[key];
  if (value === undefined || value === null) return [];
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((v) => typeof v === "string" && v.trim() !== "")
  ) {
    fail(file, `"${key}" has to be a non-empty list of non-empty strings`);
  }
  return value as string[];
}

function readYaml(file: string): unknown {
  const raw = fs.readFileSync(file, "utf8");
  try {
    return loadYaml(raw);
  } catch (error) {
    fail(path.basename(file), `invalid YAML — ${(error as Error).message}`);
  }
}

/**
 * `data/taxonomy.yaml` is the source of truth shared with the Python PR
 * validator. The TypeScript enums exist for DX, but if the two lists drift
 * apart the build has to fail here — otherwise a PR could pass Python's CI
 * and still break the site.
 */
function assertTaxonomyInSync() {
  const file = path.join(DATA_DIR, "taxonomy.yaml");
  if (!fs.existsSync(file)) return;

  const taxonomy = readYaml(file) as Record<string, string[]> | null;
  if (!taxonomy) return;

  const pairs: Array<[string, readonly string[]]> = [
    ["categories", CATEGORIES],
    ["difficulties", DIFFICULTIES],
  ];

  for (const [key, tsValues] of pairs) {
    const yamlValues = taxonomy[key] ?? [];
    const missingInTs = yamlValues.filter((v) => !tsValues.includes(v));
    const missingInYaml = tsValues.filter((v) => !yamlValues.includes(v));

    if (missingInTs.length || missingInYaml.length) {
      fail(
        "taxonomy.yaml",
        `"${key}" does not match web/src/lib/types.ts.` +
          (missingInTs.length ? ` Missing in types.ts: ${missingInTs.join(", ")}.` : "") +
          (missingInYaml.length
            ? ` Missing in taxonomy.yaml: ${missingInYaml.join(", ")}.`
            : ""),
      );
    }
  }
}

/* ── Labs ────────────────────────────────────────────────────────────────── */

function findLabFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findLabFiles(full));
    } else if (entry.isFile() && entry.name === "lab.yaml") {
      results.push(full);
    }
  }
  return results;
}

function parseObjective(file: string, index: number, raw: unknown): LabObjective {
  const label = `${file} objectives[${index}]`;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    fail(label, "each objective has to be an object");
  }
  const obj = raw as RawRecord;

  return {
    id: requireString(label, obj, "id"),
    title: requireString(label, obj, "title"),
    description: requireString(label, obj, "description"),
    hints: optionalNonEmptyStringArray(label, obj, "hints"),
    // "flag" exists in the YAML but is intentionally never read here — see
    // the note on LabObjective in types.ts.
  };
}

function parseLab(filePath: string, raw: unknown): Lab {
  const dirPath = path.dirname(path.relative(LABS_DIR, filePath)).split(path.sep).join("/");
  const file = `${dirPath}/lab.yaml`;

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    fail(file, "the file has to contain a YAML object");
  }
  const obj = raw as RawRecord;

  const slug = requireString(file, obj, "slug");
  const expectedSlug = path.basename(dirPath);
  if (slug !== expectedSlug) {
    fail(file, `"slug" ("${slug}") does not match the folder name ("${expectedSlug}")`);
  }

  const portRaw = obj.port;
  if (typeof portRaw !== "number" || !Number.isInteger(portRaw) || portRaw < 1024 || portRaw > 65535) {
    fail(file, `"port" has to be an integer between 1024 and 65535`);
  }

  const objectivesRaw = obj.objectives;
  if (!Array.isArray(objectivesRaw) || objectivesRaw.length === 0) {
    fail(file, `"objectives" has to be a non-empty list`);
  }

  return {
    slug,
    title: requireString(file, obj, "title"),
    category: requireEnum<Category>(file, obj, "category", CATEGORIES),
    difficulty: requireEnum<Difficulty>(file, obj, "difficulty", DIFFICULTIES),
    tech: requireStringArray(file, obj, "tech"),
    port: portRaw,
    description: requireString(file, obj, "description"),
    objectives: objectivesRaw.map((o, i) => parseObjective(file, i, o)),
    tags: optionalStringArray(file, obj, "tags"),
    dirPath,
  };
}

let labsCache: Lab[] | null = null;

/** Every lab in the catalog, sorted alphabetically by title. */
export function getLabs(): Lab[] {
  if (labsCache && CACHE_ENABLED) return labsCache;

  assertTaxonomyInSync();

  if (!fs.existsSync(LABS_DIR)) {
    fail(
      "content.ts",
      `could not find labs/ at ${LABS_DIR} (cwd: ${process.cwd()}). ` +
        `If this runs on Vercel with Root Directory = web/, enable ` +
        `"Include files outside of the Root Directory in the Build Step" ` +
        `in Project Settings → General → Root Directory and redeploy.`,
    );
  }

  const files = findLabFiles(LABS_DIR);
  const labs = files.map((f) => parseLab(f, readYaml(f)));

  const seenSlugs = new Map<string, string>();
  for (const lab of labs) {
    const previous = seenSlugs.get(lab.slug);
    if (previous) fail(lab.dirPath, `duplicate slug — already used by ${previous}`);
    seenSlugs.set(lab.slug, lab.dirPath);
  }

  labs.sort((a, b) => a.title.localeCompare(b.title));
  labsCache = labs;
  return labs;
}

export function getLabBySlug(slug: string): Lab | undefined {
  return getLabs().find((l) => l.slug === slug);
}
