"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "0xbuglabs-theme";

/**
 * Theme is state external to React: it lives in localStorage and the
 * system media query. `useSyncExternalStore` is the correct way to read
 * it — during hydration it returns `null`, so server and client markup
 * match, and the real value appears right after.
 */

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  // `storage` syncs the change across open tabs.
  media.addEventListener("change", onChange);
  window.addEventListener("storage", onChange);

  return () => {
    listeners.delete(onChange);
    media.removeEventListener("change", onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** There's no way to know the theme on the server. */
function getServerSnapshot(): Theme | null {
  return null;
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // The only legitimate effect: push React state into the DOM, the actual
  // external system. No setState here.
  useEffect(() => {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function toggle() {
    localStorage.setItem(STORAGE_KEY, theme === "dark" ? "light" : "dark");
    for (const listener of listeners) listener();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      // The theme is still unknown during hydration; announcing the wrong
      // opposite would mislead anyone on a screen reader.
      aria-label={
        theme ? `Switch to ${theme === "dark" ? "light" : "dark"} theme` : "Switch theme"
      }
      className="grid size-8 place-items-center rounded-sm border border-line-subtle text-ink-3 transition-colors hover:border-line hover:text-ink"
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        className="size-4"
        aria-hidden="true"
      >
        {theme === "dark" ? (
          <>
            <circle cx="8" cy="8" r="3.1" />
            <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.95 3.05l-1.13 1.13M4.18 11.82l-1.13 1.13M12.95 12.95l-1.13-1.13M4.18 4.18L3.05 3.05" />
          </>
        ) : (
          <path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1Z" />
        )}
      </svg>
    </button>
  );
}
