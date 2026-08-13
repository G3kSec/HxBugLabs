import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line-subtle py-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5 shrink-0 text-accent"
            aria-hidden="true"
          >
            <path d="m4 17 6-6-6-6" />
            <path d="M12 19h8" />
          </svg>
          <p className="font-mono text-sm tracking-tight">
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
        </div>

        <div className="flex items-center gap-6">
          <Link href="/labs" className="label transition-colors hover:!text-accent">
            Labs
          </Link>
          <a
            href="https://github.com/G3kSec/0xBugLabs"
            target="_blank"
            rel="noreferrer noopener"
            className="label transition-colors hover:!text-accent"
          >
            GitHub
          </a>
          <p className="label nums">&copy; {new Date().getFullYear()}</p>
        </div>
      </div>
    </footer>
  );
}
