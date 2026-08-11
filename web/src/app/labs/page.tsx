import type { Metadata } from "next";

import { LabCatalog } from "@/components/lab-catalog";
import { getLabs } from "@/lib/content";

export const metadata: Metadata = {
  title: "Labs",
  description:
    "Browse the 0xBugLabs catalog — self-hosted, Docker-based labs for practicing bug bounty vulnerabilities and recon techniques.",
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
          .
        </p>
      </header>

      <LabCatalog labs={labs} />
    </div>
  );
}
