"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Lab progress, kept in the browser.
 *
 * There is no backend and no account — the catalog is a static build — so
 * "completed" means "this browser has seen the right flag for this
 * objective". Clearing site data clears progress, and that is the whole
 * contract. It is stated on the page rather than hidden, so nobody
 * mistakes this for a leaderboard.
 */

const STORAGE_KEY = "hxbuglabs:progress:v1";

/** `{ [labSlug]: { [objectiveId]: ISO timestamp } }` */
export type Progress = Record<string, Record<string, string>>;

/** Fires when progress changes in this tab; `storage` covers other tabs. */
const CHANGE_EVENT = "hxbuglabs:progress-change";

/** Stable empty snapshot, so SSR and a first paint never allocate a new object. */
const EMPTY: Progress = {};

function parse(raw: string): Progress {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return EMPTY;
    return parsed as Progress;
  } catch {
    return EMPTY;
  }
}

/* useSyncExternalStore compares snapshots by identity, so the parsed value
   is cached against the raw string it came from — re-parsing on every read
   would hand React a new object each time and loop forever. */
let cachedRaw: string | null = null;
let cachedValue: Progress = EMPTY;

function getSnapshot(): Progress {
  let raw = "";
  try {
    raw = window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    // Private mode or blocked storage: behave as if nothing is recorded.
    return EMPTY;
  }

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parse(raw);
  }
  return cachedValue;
}

/** The build has no idea what this browser solved, so it renders as empty. */
function getServerSnapshot(): Progress {
  return EMPTY;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(progress: Progress) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Nothing useful to do: the page still works, it just will not remember.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** SHA-256 of `value` as lowercase hex, via the Web Crypto API. */
export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Reads progress and re-renders on change, including changes made in
 * another tab.
 *
 * `hydrated` is false on the server and during hydration, so a component
 * can render exactly what the build produced and fill in afterwards
 * rather than mismatching.
 */
export function useProgress() {
  const progress = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const complete = useCallback((labSlug: string, objectiveId: string) => {
    const next: Progress = { ...getSnapshot() };
    next[labSlug] = { ...(next[labSlug] ?? {}), [objectiveId]: new Date().toISOString() };
    write(next);
  }, []);

  const reset = useCallback((labSlug?: string) => {
    if (!labSlug) {
      write(EMPTY);
      return;
    }
    const next: Progress = { ...getSnapshot() };
    delete next[labSlug];
    write(next);
  }, []);

  return { progress, hydrated, complete, reset };
}

/** How many objectives of a lab this browser has solved. */
export function solvedCount(progress: Progress, labSlug: string): number {
  return Object.keys(progress[labSlug] ?? {}).length;
}
