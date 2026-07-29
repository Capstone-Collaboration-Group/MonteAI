// packages/ui/src/components/Thesis/ThesisCatalog.tsx
import { useState } from "react";
import type { ThesisSummary, SubmissionHealthStatus, ThesisCatalogCounts, ThesisStatus } from "@monteai/types";

import { FeaturedThesisCard } from "./FeaturedThesisCard";
import { SubmissionHealthCard } from "./SubmissionHealthCard";
import { ThesisListView } from "./ThesisListView";
import { PageHeader } from "../common/PageHeader";
import { Input } from "@monteai/ui/components/Input";

type StatusFilter = "None" | ThesisStatus;

interface ThesisCatalogProps {
  featuredThesis: ThesisSummary;
  theses: ThesisSummary[];
  healthStats: SubmissionHealthStatus;
  counts: ThesisCatalogCounts;
  isLoading?: boolean;
  onViewDetails?: (thesisId: string) => void;
  onSelectThesis?: (thesisId: string) => void;
  onThesisAction?: (thesisId: string) => void;
}

const STATUS_OPTIONS: StatusFilter[] = ["None", "pending", "approved", "rejected", "revision"];

export function ThesisCatalog({
  featuredThesis,
  theses,
  healthStats,
  counts,
  isLoading,
  onViewDetails,
  onSelectThesis,
  onThesisAction,
}: ThesisCatalogProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("None");
  const [search, setSearch] = useState("");

  const filteredTheses = theses.filter((item) => {
    if (statusFilter !== "None" && item.status !== statusFilter) return false;

    const q = search.trim().toLowerCase();
    if (!q) return true;

    return (
      item.title.toLowerCase().includes(q) ||
      item.institute.toLowerCase().includes(q) ||
      item.authors.some((a) => a.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex max-w-6xl flex-col gap-6 p-8">
      <PageHeader
        eyebrow="Thesis management"
        title="Catalog"
        actions={
          <>
            <div className="w-full sm:w-80">
              <Input
                placeholder="Search by title, author, or institute"
                value={search}
                onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
                className="rounded-full border-outline-variant bg-surface-container-low"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-full border border-outline-variant bg-surface-container-low px-4 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === "None" ? "All statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </>
        }
      />

      <p className="text-sm text-on-surface-variant">
        Reviewing {counts.active} active submissions and {counts.archived} archived works.
      </p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        <FeaturedThesisCard thesis={featuredThesis} onViewDetails={onViewDetails} />
        <SubmissionHealthCard stats={healthStats} />
      </div>

      <ThesisListView
        theses={filteredTheses}
        onSelect={onSelectThesis}
        onAction={onThesisAction}
      />
    </div>
  );
}