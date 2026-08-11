import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line-subtle">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-sm">
            <span className="text-accent">0x</span>
            <span className="text-ink">BugLabs</span>
            <span className="text-ink-3"> — by </span>
            <a
              href="https://github.com/G3kSec"
              target="_blank"
              rel="noreferrer noopener"
              className="text-ink-2 transition-colors hover:text-accent"
            >
              G3kSec
            </a>
          </p>
          <p className="mt-1 max-w-md text-sm text-ink-3">
            Self-hosted, Docker-based labs for bug bounty practice. Every lab
            runs on your machine — this site is only the catalog.
          </p>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <Link href="/labs" className="text-ink-2 transition-colors hover:text-accent">
            Labs
          </Link>
          <a
            href="https://github.com/G3kSec/0xBugLabs"
            target="_blank"
            rel="noreferrer noopener"
            className="text-ink-2 transition-colors hover:text-accent"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
