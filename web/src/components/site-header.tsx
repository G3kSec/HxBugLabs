import Link from "next/link";

import { ThemeToggle } from "./theme-toggle";

const NAV = [{ href: "/labs", label: "Labs" }] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line-subtle bg-ground/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
        <Link
          href="/"
          className="flex shrink-0 items-baseline gap-px font-mono text-[0.9375rem] font-semibold tracking-tight"
        >
          <span className="text-accent">0x</span>
          <span className="text-ink">BugLabs</span>
        </Link>

        <nav className="flex flex-1 items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-sm px-2.5 py-1.5 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <a
            href="https://github.com/G3kSec/0xBugLabs"
            target="_blank"
            rel="noreferrer noopener"
            aria-label="GitHub repository"
            className="grid size-8 place-items-center rounded-sm border border-line-subtle text-ink-3 transition-colors hover:border-line hover:text-ink"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="size-4" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
