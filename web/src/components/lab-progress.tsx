"use client";

import { solvedCount, useProgress } from "@/lib/progress";

/**
 * "2/3 captured" for one lab. Renders nothing until storage has been read
 * and nothing at all if this browser has solved none of it, so the card
 * grid stays quiet for a first-time visitor.
 */
export function LabProgress({ slug, total }: { slug: string; total: number }) {
  const { progress, hydrated } = useProgress();
  if (!hydrated) return null;

  const solved = solvedCount(progress, slug);
  if (solved === 0) return null;

  const done = solved >= total;

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-2xs ${
        done ? "text-diff-easy" : "text-ink-2"
      }`}
    >
      {done ? "✓" : null} {solved}/{total} captured
    </span>
  );
}

/** Catalog-wide tally, shown above the lab grid once anything is solved. */
export function CatalogProgress({
  labs,
}: {
  labs: Array<{ slug: string; objectives: number }>;
}) {
  const { progress, hydrated, reset } = useProgress();
  if (!hydrated) return null;

  const solved = labs.reduce((sum, lab) => sum + Math.min(solvedCount(progress, lab.slug), lab.objectives), 0);
  if (solved === 0) return null;

  const total = labs.reduce((sum, lab) => sum + lab.objectives, 0);
  const labsDone = labs.filter((lab) => solvedCount(progress, lab.slug) >= lab.objectives).length;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-line-subtle bg-surface px-4 py-2.5">
      <span className="font-mono text-xs text-ink">
        {solved}/{total} objectives captured
      </span>
      <span className="font-mono text-2xs text-ink-3">
        {labsDone} of {labs.length} labs finished
      </span>
      <span className="ml-auto font-mono text-2xs text-ink-3">
        stored in this browser only ·{" "}
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Clear all recorded progress in this browser?")) reset();
          }}
          className="underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          clear
        </button>
      </span>
    </div>
  );
}
