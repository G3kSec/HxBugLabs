/**
 * HxBugLabs data models.
 *
 * All content lives as YAML under `labs/` and `data/taxonomy.yaml`, parsed
 * at build time. These types are the contract that `scripts/validate.py`
 * (Python) enforces on the content side.
 */

export const CATEGORIES = [
  "SQL / NoSQL Injection",
  "Command Injection",
  "XSS",
  "SSRF",
  "CSRF",
  "XXE",
  "SSTI",
  "Access Control / IDOR",
  "Auth",
  "File Upload",
  "Deserialization",
  "Race Condition",
  "Business Logic",
  "API / GraphQL",
  "Cache Poisoning",
  "Request Smuggling",
  "Prototype Pollution",
  "Recon / OSINT",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * One objective within a lab.
 *
 * Deliberately has no `flag` field. The catalog ships a SHA-256 of the
 * flag instead, so the browser can tell someone whether what they pasted
 * is correct without the answer ever being in the bundle. A hash is not a
 * secret — anyone determined can brute-force a known-format string — but
 * it keeps the flag out of view-source, which is the point.
 */
export interface LabObjective {
  id: string;
  title: string;
  description: string;
  /** Progressive nudges, shown behind a collapsed section on the site. */
  hints: string[];
  /** Lowercase hex SHA-256 of the objective's flag. */
  flagHash: string;
}

/** A single lab, sourced from one `labs/<category>/<slug>/lab.yaml`. */
export interface Lab {
  slug: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  tech: string[];
  port: number;
  description: string;
  objectives: LabObjective[];
  tags: string[];
  /** Path under `labs/`, e.g. `"idor/helpdesk-ticket-access"`. */
  dirPath: string;
}
