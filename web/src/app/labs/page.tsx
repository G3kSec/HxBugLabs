import type { Metadata } from "next";

import { LabCatalog } from "@/components/lab-catalog";
import { CatalogProgress } from "@/components/lab-progress";
import { getLabs } from "@/lib/content";

export const metadata: Metadata = {
  title: "Labs",
  description:
    "Browse the HxBugLabs catalog — self-hosted, Docker-based labs for practicing bug bounty vulnerabilities and recon techniques.",
};

export default function LabsPage() {
  const labs = getLabs();

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="mb-8">
        <p className="label mb-1.5">Catalog</p>
        <h1 className="text-3xl font-semibold tracking-tight">Labs</h1>
        <p className="mt-2 max-w-[60ch] text-ink-2">
          Every lab is a self-contained Docker Compose stack that runs on
          your machine. Pick one, clone the repo, and{" "}
          <code className="rounded-sm bg-surface-2 px-1 py-0.5 font-mono text-sm">
            docker compose up -d
          </code>
          . Capture a flag, paste it on the lab&apos;s page, and this browser
          remembers it.
        </p>
      </header>

      <CatalogProgress
        labs={labs.map((lab) => ({ slug: lab.slug, objectives: lab.objectives.length }))}
      />

      <LabCatalog labs={labs} />
    </div>
  );
}
