export function BetaBanner() {
  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex h-9 items-center justify-center gap-2 border-b border-line-subtle bg-accent/10 px-4 text-center backdrop-blur-md">
      <span className="label shrink-0 !text-accent">Beta</span>
      <p className="truncate text-xs text-ink-2">
        This catalog is a work in progress — I&apos;m actively polishing it and adding new labs.
      </p>
    </div>
  );
}
