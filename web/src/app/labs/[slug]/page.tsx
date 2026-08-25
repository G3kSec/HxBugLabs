import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Chip, DifficultyBadge } from "@/components/ui";
import { getLabBySlug, getLabs } from "@/lib/content";

const REPO_URL = "https://github.com/G3kSec/HxBugLabs";

export function generateStaticParams() {
  return getLabs().map((lab) => ({ slug: lab.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lab = getLabBySlug(slug);
  if (!lab) return {};

  return {
    title: lab.title,
    description: lab.description,
  };
}

export default async function LabDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lab = getLabBySlug(slug);
  if (!lab) notFound();

  const folderUrl = `${REPO_URL}/tree/main/labs/${lab.dirPath}`;
  const solutionUrl = `${REPO_URL}/blob/main/labs/${lab.dirPath}/SOLUTION.md`;

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link
        href="/labs"
        className="font-mono text-xs text-ink-3 transition-colors hover:text-accent"
      >
        ← All labs
      </Link>

      <header className="mt-4 mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <DifficultyBadge difficulty={lab.difficulty} />
          <Chip tone="accent">{lab.category}</Chip>
        </div>

        <h1 className="text-balance text-3xl font-semibold tracking-tight">
          {lab.title}
        </h1>

        <p className="mt-3 max-w-[65ch] text-lg text-ink-2">{lab.description}</p>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {lab.tech.map((t) => (
            <Chip key={t} tone="outline">
              {t}
            </Chip>
          ))}
        </div>
      </header>

      {/* ── Run it ──────────────────────────────────────────────────── */}
      <section className="mb-8 rounded-md border border-line-subtle bg-surface p-5">
        <p className="label mb-3">Run it locally</p>
        <pre className="overflow-x-auto rounded-sm bg-surface-2 p-3 font-mono text-sm text-ink">
          <code>{`git clone ${REPO_URL}.git
cd HxBugLabs/labs/${lab.dirPath}
docker compose up -d`}</code>
        </pre>
        <p className="mt-3 text-sm text-ink-2">
          The app is at{" "}
          <code className="rounded-sm bg-surface-2 px-1 py-0.5 font-mono text-xs">
            http://localhost:{lab.port}
          </code>
          . Tear down with{" "}
          <code className="rounded-sm bg-surface-2 px-1 py-0.5 font-mono text-xs">
            docker compose down
          </code>
          .
        </p>
      </section>

      {/* ── Objectives ──────────────────────────────────────────────── */}
      <section className="mb-8">
        <p className="label mb-3">
          Objectives ({lab.objectives.length})
        </p>
        <ol className="flex flex-col gap-3">
          {lab.objectives.map((objective, index) => (
            <li
              key={objective.id}
              className="rounded-md border border-line-subtle bg-surface p-4"
            >
              <div className="flex items-baseline gap-2.5">
                <span className="nums shrink-0 font-mono text-xs text-ink-3">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold tracking-tight">{objective.title}</h3>
                  <p className="mt-1 text-sm text-ink-2">{objective.description}</p>

                  {objective.hints.length > 0 ? (
                    <details className="group mt-2.5">
                      <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 font-mono text-2xs text-ink-3 transition-colors hover:text-accent">
                        <span className="inline-block transition-transform group-open:rotate-90">
                          ▸
                        </span>
                        Hints ({objective.hints.length}) — stuck? optional, no spoilers
                      </summary>
                      <ol className="mt-2 flex flex-col gap-1.5 border-l border-line-subtle py-0.5 pl-3">
                        {objective.hints.map((hint, hintIndex) => (
                          <li key={hintIndex} className="text-sm text-ink-2">
                            <span className="nums mr-1.5 font-mono text-2xs text-ink-3">
                              {hintIndex + 1}.
                            </span>
                            {hint}
                          </li>
                        ))}
                      </ol>
                    </details>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {lab.tags.length > 0 ? (
        <section className="mb-8 flex flex-wrap gap-1.5">
          {lab.tags.map((tag) => (
            <Chip key={tag}>{tag}</Chip>
          ))}
        </section>
      ) : null}

      {/* ── Links ───────────────────────────────────────────────────── */}
      <section className="flex flex-wrap items-center gap-4 border-t border-line-subtle pt-6 font-mono text-xs">
        <a
          href={folderUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-ink-2 transition-colors hover:text-accent"
        >
          View lab source →
        </a>
        <a
          href={solutionUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-ink-3 transition-colors hover:text-accent"
        >
          Solution walkthrough (spoilers) →
        </a>
      </section>
    </div>
  );
}
