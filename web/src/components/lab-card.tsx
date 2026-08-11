import Link from "next/link";

import { DIFFICULTY_STYLES } from "@/lib/format";
import type { Lab } from "@/lib/types";

import { Chip, DifficultyBadge } from "./ui";

/**
 * The difficulty rail on the left is the catalog's visual signature: it
 * lets you scan a grid of labs and spot the easy ones (or the hard ones)
 * without reading a single word.
 */
export function LabCard({ lab }: { lab: Lab }) {
  const rail = DIFFICULTY_STYLES[lab.difficulty].rail;

  return (
    <article className="group relative flex overflow-hidden rounded-md border border-line-subtle bg-surface transition-colors hover:border-line">
      <div className={`w-[3px] shrink-0 ${rail}`} aria-hidden="true" />

      <div className="min-w-0 flex-1 p-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <DifficultyBadge difficulty={lab.difficulty} />
          <Chip tone="accent">{lab.category}</Chip>
        </div>

        <h3 className="text-balance text-base font-semibold leading-snug tracking-tight">
          <Link
            href={`/labs/${lab.slug}`}
            className="transition-colors after:absolute after:inset-0 hover:text-accent"
          >
            {lab.title}
          </Link>
        </h3>

        <p className="mt-1.5 line-clamp-2 text-sm text-ink-2">{lab.description}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-2xs text-ink-3">
          <span>{lab.objectives.length} objective{lab.objectives.length === 1 ? "" : "s"}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{lab.tech.join(", ")}</span>
        </div>
      </div>
    </article>
  );
}
