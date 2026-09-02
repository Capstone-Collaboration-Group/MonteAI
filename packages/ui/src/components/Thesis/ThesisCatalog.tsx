// packages/ui/src/components/Thesis/ThesisCatalog.tsx
import { useState } from "react";
import type { ThesisSummary, SubmissionHealthStatus, ThesisCatalogCounts, ThesisStatus, ThesisActionType } from "@monteai/types";

import { FeaturedThesisCard } from "./FeaturedThesisCard";
import { SubmissionHealthCard } from "./SubmissionHealthCard";
import { ThesisListView } from "./ThesisListView";
import { PageHeader, PageLayout} from "../common";
import { Input } from "../Input";

type StatusFilter = "None" | ThesisStatus;

interface ThesisCatalogProps {
  featuredThesis: ThesisSummary;
  theses: ThesisSummary[];
  healthStats: SubmissionHealthStatus;
  counts: ThesisCatalogCounts;
  isLoading?: boolean;
  onViewDetails?: (thesisId: string) => void;
  onSelectThesis?: (thesisId: string) => void;
  onThesisAction?: (thesisId: string, action: ThesisActionType) => void;
  allowedActions?: ThesisActionType[];
  // onFilterClick?: () => void;
}
const STATUS_OPTIONS: StatusFilter[] = ["None", "pending", "approved", "rejected", "revision", "indexed"];

export function ThesisCatalog({
  featuredThesis,
  theses,
  healthStats,
  counts,
  isLoading,
  onViewDetails,
  onSelectThesis,
  onThesisAction,
  allowedActions = [],
  // onFilterClick,  
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
      item.authors?.some((a) => a.toLowerCase().includes(q))
    );
  });

 return (
    // 2. Wrap the whole screen in PageLayout, allowing internal scrolling
    <PageLayout className="overflow-y-auto">
      
      {/* 3. Keep your content constrained and centered */}
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-8">
        
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

              {/* 4. Swapped native <select> for your reusable Select component */}
              <div className="w-48">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="rounded-full bg-surface-container-low"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s === "None" ? "All statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
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
          onSelect={onViewDetails ?? onSelectThesis}
          onAction={onThesisAction}
          allowedActions={allowedActions}
        />
      </div>
    </PageLayout>
  );

}