import Link from "next/link";

import { LabCard } from "@/components/lab-card";
import { getLabs } from "@/lib/content";

export default function HomePage() {
  const labs = getLabs();

  const categories = new Set(labs.map((l) => l.category)).size;
  const objectives = labs.reduce((sum, l) => sum + l.objectives.length, 0);

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="grid-bg border-b border-line-subtle">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <p className="label mb-4">Self-hosted · Bug bounty practice</p>

          <h1 className="max-w-[22ch] text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            Practice on labs that behave like{" "}
            <span className="text-accent">real targets</span>.
          </h1>

          <p className="mt-5 max-w-[58ch] text-lg text-ink-2">
            Docker-based labs for bug bounty vulnerabilities and recon
            techniques. Toy apps, not CVE reproductions — but with real
            login flows, multiple objectives, and nothing about the bug
            telegraphed in the UI. Everything runs on your machine.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/labs"
              className="rounded-sm bg-accent px-4 py-2 font-mono text-xs font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
            >
              Browse the labs
            </Link>
            <a
              href="https://github.com/G3kSec/0xBugLabs"
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-sm border border-line px-4 py-2 font-mono text-xs text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              View on GitHub
            </a>
          </div>

          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-x-8 gap-y-5">
            <Stat value={String(labs.length)} label="labs" />
            <Stat value={String(categories)} label="categories" />
            <Stat value={String(objectives)} label="objectives" />
          </dl>
        </div>
      </section>

      {/* ── The labs ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <div>
            <p className="label mb-1">Catalog</p>
            <h2 className="text-xl font-semibold tracking-tight">The labs</h2>
          </div>
          <Link
            href="/labs"
            className="shrink-0 font-mono text-xs text-accent transition-opacity hover:opacity-70"
          >
            see all →
          </Link>
        </div>

        <div className="grid gap-2.5 md:grid-cols-2">
          {labs.map((lab) => (
            <LabCard key={lab.slug} lab={lab} />
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="mb-5">
          <p className="label mb-1">How it works</p>
          <h2 className="text-xl font-semibold tracking-tight">
            One folder, one Docker Compose stack
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card
            title="Nothing leaves your machine"
            body="This site is only the catalog, deployed once as a static build. Every lab is a container you run and destroy locally — never exposed, never shared."
          />
          <Card
            title="Multiple objectives, one flag each"
            body="Real targets rarely have just one bug. A lab can chain a low-privilege find into something bigger, closer to how an actual engagement goes."
          />
          <Card
            title="Content lives in the repo"
            body="Each lab is a folder with a lab.yaml the catalog reads at build time. No database, no admin panel — the change history is the git history."
          />
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  // The number reads first, but in the DOM <dt> has to precede <dd>:
  // flipped with flex rather than duplicating the text for screen readers.
  return (
    <div className="flex flex-col-reverse">
      <dt className="label">{label}</dt>
      <dd className="nums font-mono text-2xl font-semibold tracking-tight">
        {value}
      </dd>
    </div>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-line-subtle bg-surface p-5">
      <h3 className="font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm text-ink-2">{body}</p>
    </div>
  );
}
