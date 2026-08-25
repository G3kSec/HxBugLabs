import Link from "next/link";

import { ThemeToggle } from "./theme-toggle";

const NAV = [{ href: "/labs", label: "Labs" }] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-9 z-50 border-b border-line-subtle bg-ground/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
        <Link
          href="/"
          className="flex shrink-0 items-baseline gap-px font-mono text-[0.9375rem] font-semibold tracking-tight"
        >
          <span className="text-accent">Hx</span>
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
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
