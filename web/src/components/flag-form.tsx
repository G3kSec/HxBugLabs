"use client";

import { useState } from "react";

import { sha256Hex, useProgress } from "@/lib/progress";
import type { LabObjective } from "@/lib/types";

type Status = "idle" | "checking" | "wrong" | "error";

/**
 * Flag entry for one objective.
 *
 * The flag itself is never in the bundle — only its SHA-256 — so this
 * hashes what was pasted and compares. Wrong answers say so and nothing
 * else: no "close", no character count, nothing that would turn the form
 * into an oracle for guessing the flag.
 */
export function FlagForm({
  labSlug,
  objective,
}: {
  labSlug: string;
  objective: LabObjective;
}) {
  const { progress, hydrated, complete, reset } = useProgress();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const solvedAt = progress[labSlug]?.[objective.id];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const candidate = value.trim();
    if (!candidate) return;

    setStatus("checking");
    try {
      const hash = await sha256Hex(candidate);
      if (hash === objective.flagHash) {
        complete(labSlug, objective.id);
        setValue("");
        setStatus("idle");
      } else {
        setStatus("wrong");
      }
    } catch {
      // crypto.subtle needs a secure context: https, or localhost.
      setStatus("error");
    }
  }

  // Nothing until hydration, so the first paint matches the build output.
  if (!hydrated) return <div className="mt-3 h-9" aria-hidden="true" />;

  if (solvedAt) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-sm border border-diff-easy/30 bg-diff-easy-bg px-2.5 py-1.5">
        <span className="font-mono text-2xs font-medium text-diff-easy">✓ Captured</span>
        <span className="font-mono text-2xs text-ink-3">
          {new Date(solvedAt).toLocaleDateString()}
        </span>
        <button
          type="button"
          onClick={() => reset(labSlug)}
          className="ml-auto font-mono text-2xs text-ink-3 underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          reset lab
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (status !== "idle") setStatus("idle");
          }}
          spellCheck={false}
          autoComplete="off"
          placeholder="HxBugLabs{…}"
          aria-label={`Flag for ${objective.title}`}
          className="min-w-0 flex-1 rounded-sm border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "checking"}
          className="rounded-sm border border-accent-border bg-accent-bg px-3 py-1.5 font-mono text-2xs font-medium text-accent transition-colors hover:bg-accent hover:text-surface disabled:opacity-50"
        >
          {status === "checking" ? "Checking" : "Submit"}
        </button>
      </div>

      {status === "wrong" ? (
        <p className="mt-1.5 font-mono text-2xs text-diff-hard">
          Not this one. Flags are case-sensitive, braces included.
        </p>
      ) : null}
      {status === "error" ? (
        <p className="mt-1.5 font-mono text-2xs text-diff-hard">
          Your browser blocked the hashing API — flag checking needs https or localhost.
        </p>
      ) : null}
    </form>
  );
}
