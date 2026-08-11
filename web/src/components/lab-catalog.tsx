"use client";

import { useMemo, useState } from "react";

import type { Difficulty, Lab } from "@/lib/types";

import { LabCard } from "./lab-card";

interface Props {
  labs: Lab[];
}

function countBy<K extends string>(items: Lab[], pick: (l: Lab) => K) {
  const counts = new Map<K, number>();
  for (const item of items) {
    const key = pick(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

const DIFFICULTY_ORDER: Difficulty[] = ["Easy", "Medium", "Hard"];

export function LabCatalog({ labs }: Props) {
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [difficulties, setDifficulties] = useState<Set<string>>(new Set());

  const facets = useMemo(() => {
    const byCategory = countBy(labs, (l) => l.category);
    const byDifficulty = countBy(labs, (l) => l.difficulty);

    return {
      categories: [...byCategory.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      ),
      difficulties: DIFFICULTY_ORDER.filter((d) => byDifficulty.has(d)).map(
        (d) => [d, byDifficulty.get(d) ?? 0] as [string, number],
      ),
    };
  }, [labs]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return labs.filter((lab) => {
      if (categories.size > 0 && !categories.has(lab.category)) return false;
      if (difficulties.size > 0 && !difficulties.has(lab.difficulty)) return false;

      if (needle) {
        const haystack = [
          lab.title,
          lab.description,
          lab.category,
          lab.difficulty,
          ...lab.tech,
          ...lab.tags,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }

      return true;
    });
  }, [labs, query, categories, difficulties]);

  const activeCount = categories.size + difficulties.size + (query.trim() ? 1 : 0);

  function toggle(set: Set<string>, apply: (next: Set<string>) => void, value: string) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    apply(next);
  }

  function clearAll() {
    setQuery("");
    setCategories(new Set());
    setDifficulties(new Set());
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      {/* ── Filters ─────────────────────────────────────────────────── */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="flex items-center justify-between gap-2 pb-3">
          <p className="label">Filters</p>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="font-mono text-2xs text-accent transition-opacity hover:opacity-70"
            >
              clear ({activeCount})
            </button>
          ) : null}
        </div>

        <label className="block pb-4">
          <span className="sr-only">Search labs</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search…"
            className="w-full rounded-sm border border-line-subtle bg-surface px-2.5 py-1.5 font-mono text-xs text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
        </label>

        <div className="flex flex-col gap-5">
          <FilterGroup
            title="Difficulty"
            options={facets.difficulties}
            selected={difficulties}
            onToggle={(value) => toggle(difficulties, setDifficulties, value)}
          />

          <FilterGroup
            title="Category"
            options={facets.categories}
            selected={categories}
            onToggle={(value) => toggle(categories, setCategories, value)}
          />
        </div>
      </aside>

      {/* ── Grid ────────────────────────────────────────────────────── */}
      <div>
        <p className="nums pb-4 font-mono text-2xs text-ink-3">
          {filtered.length} of {labs.length} labs
        </p>

        {filtered.length === 0 ? (
          <div className="rounded-md border border-dashed border-line px-5 py-12 text-center">
            <p className="text-ink-2">No labs match these filters.</p>
            <button
              type="button"
              onClick={clearAll}
              className="mt-2 font-mono text-xs text-accent transition-opacity hover:opacity-70"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid gap-2.5 md:grid-cols-2">
            {filtered.map((lab) => (
              <LabCard key={lab.slug} lab={lab} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: Array<[string, number]>;
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) return null;

  return (
    <div>
      <p className="label pb-2">{title}</p>
      <div className="flex flex-wrap gap-1">
        {options.map(([value, count]) => {
          const isActive = selected.has(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => onToggle(value)}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-2xs transition-colors ${
                isActive
                  ? "border-accent-border bg-accent-bg text-accent"
                  : "border-line-subtle text-ink-3 hover:border-line hover:text-ink-2"
              }`}
            >
              {value}
              <span className={`nums ${isActive ? "opacity-70" : "opacity-50"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
