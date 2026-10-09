// packages/ui/src/components/Thesis/ThesisCatalog.tsx
import { useEffect, useState } from "react";
import { toThesisSummary } from "@monteai/types";
import type { ThesisSummary, ThesisResponseDto, ThesisCatalogCounts, ThesisStatus, ThesisActionType } from "@monteai/types";

import { FeaturedThesisCard } from "./FeaturedThesisCard";
import { SubmissionHealthCard } from "./SubmissionHealthCard";
import { ThesisListView } from "./ThesisListView";
import { PageHeader, PageLayout} from "../common";
import { Input } from "../Input";
import { Button } from "../Button";
import { Alert } from "../common/Alert";
import { LoaderCircle, Search, UploadCloud, X } from "lucide-react";

type StatusFilter = "None" | ThesisStatus;

/** Status banner for catalog operations (edit/delete results, load failures). */
export interface CatalogNotice {
    variant: "success" | "error";
    message: string;
}

interface ThesisCatalogProps {
  featuredThesis: ThesisSummary | null;
  theses: ThesisSummary[];
  thesisData: ThesisResponseDto[];
  counts: ThesisCatalogCounts;
  isLoading?: boolean;
  onViewDetails?: (thesisId: string) => void;
  onSelectThesis?: (thesisId: string) => void;
  onThesisAction?: (thesisId: string, action: ThesisActionType) => void;
  allowedActions?: ThesisActionType[];
  /** RBAC: only render the upload CTA when the viewer is allowed to upload (Admin). */
  canUpload?: boolean;
  onUploadThesis?: () => void;
  /** Optional banner above the catalog (edit/delete results, load failures). */
  notice?: CatalogNotice | null;
  onDismissNotice?: () => void;
  searchTheses: (query: string, mode: "exact" | "semantic") => Promise<ThesisResponseDto[]>;
  // onFilterClick?: () => void;
}
const STATUS_OPTIONS: StatusFilter[] = ["None", "pending", "approved", "rejected", "revision", "indexed"];
const SPARSE_SEARCH_THRESHOLD = 3;

export function ThesisCatalog({
  featuredThesis,
  theses,
  thesisData,
  counts,

  onViewDetails,
  onSelectThesis,
  onThesisAction,
  allowedActions = [],
  canUpload = false,
  onUploadThesis,
  notice = null,
  onDismissNotice,
  searchTheses,
  // onFilterClick,  
}: ThesisCatalogProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("None");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ThesisSummary[] | null>(null);
  const [searchMode, setSearchMode] = useState<"exact" | "semantic" | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchComplete, setSearchComplete] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    const query = debouncedSearch.trim();
    if (!query) return;

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      try {
        const exactDtos = await searchTheses(query, "exact");
        if (!active) return;
        const exactResults = exactDtos.map(toThesisSummary);

        if (exactResults.length >= SPARSE_SEARCH_THRESHOLD) {
          setSearchResults(exactResults);
          setSearchMode("exact");
          setSearchComplete(true);
          setSearchLoading(false);
          return;
        }

        setSearchResults(exactResults);
        setSearchMode("exact");
        try {
          const semanticDtos = await searchTheses(query, "semantic");
          if (!active) return;
          const semanticResults = semanticDtos.map(toThesisSummary);
          const exactIds = new Set(exactResults.map((thesis) => thesis.id));
          setSearchResults([
            ...exactResults,
            ...semanticResults.filter((thesis) => !exactIds.has(thesis.id)),
          ].slice(0, 10));
          setSearchMode("semantic");
        } catch {
          if (!active) return;
          if (exactResults.length > 0) {
            setSearchError("Closest matches couldn't be loaded. Showing direct matches instead.");
          } else {
            setSearchError("Search is unavailable right now. Try again in a moment.");
          }
        }
        setSearchComplete(true);
        setSearchLoading(false);
      } catch {
        if (!active) return;
        setSearchError("Search is unavailable right now. Try again in a moment.");
        setSearchComplete(true);
        setSearchLoading(false);
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [debouncedSearch, searchTheses]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setDebouncedSearch("");
    setSearchResults(null);
    setSearchMode(null);
    setSearchError(null);
    setSearchComplete(false);
    setSearchLoading(Boolean(value.trim()));
  };

  const isSearching = Boolean(search.trim());
  const listTheses = isSearching ? searchResults ?? [] : theses;
  const filteredTheses = listTheses.filter((item) => {
    if (statusFilter !== "None" && item.status !== statusFilter) return false;

    return true;
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
              {canUpload && onUploadThesis && (
                <Button
                  type="button"
                  onClick={onUploadThesis}
                  className="rounded-full shadow-sm"
                >
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <UploadCloud className="h-4 w-4" />
                    Upload thesis
                  </span>
                </Button>
              )}

              <div className="relative w-full sm:w-80">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline"
                />
                <Input
                  aria-label="Search theses by title, author, or keywords"
                  placeholder="Search by title, author, or keywords"
                  value={search}
                  onChange={(e) => handleSearchChange(e.currentTarget.value)}
                  className="rounded-full border-outline-variant bg-surface-container-low pl-9 pr-9"
                />
                {searchLoading && (
                  <LoaderCircle
                    aria-label="Searching theses"
                    className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary"
                  />
                )}
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

        {notice && (
          <div className="relative">
            <Alert
              variant={notice.variant}
              title={notice.variant === "success" ? "Done" : "Something went wrong"}
              message={notice.message}
            />
            {onDismissNotice && (
              <button
                type="button"
                aria-label="Dismiss notice"
                onClick={onDismissNotice}
                className="absolute right-3 top-3 rounded-full p-1 text-on-surface-variant transition-colors hover:bg-black/5"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {isSearching ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-on-surface-variant" aria-live="polite">
            {searchMode === "semantic" && !searchLoading && (
              <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-medium">
                Showing closest matches
              </span>
            )}
            {!searchLoading && searchComplete && !searchError && (
              <span>{filteredTheses.length} results</span>
            )}
            {searchError && <span role="status">{searchError}</span>}
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">
            Reviewing {counts.active} active submissions and {counts.archived} archived works.
          </p>
        )}

        {!isSearching && featuredThesis ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
            <FeaturedThesisCard thesis={featuredThesis} onViewDetails={onViewDetails} />
            <SubmissionHealthCard theses={thesisData} />
          </div>
        ) : null}

        <ThesisListView
          theses={filteredTheses}
          emptyMessage={
            searchError
              ? searchError
              : isSearching && searchComplete && searchResults?.length === 0
              ? "No theses found. Try different keywords or check the spelling."
              : isSearching
              ? "No theses match your current search or status filter."
              : theses.length === 0
              ? "No theses are available yet. New submissions and archived works will appear here."
              : "No theses match your current search or status filter."
          }
          isLoading={searchLoading}
          onSelect={onViewDetails ?? onSelectThesis}
          onAction={onThesisAction}
          allowedActions={allowedActions}
        />
      </div>
    </PageLayout>
  );

}