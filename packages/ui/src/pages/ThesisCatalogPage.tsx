// packages/ui/src/pages/ThesisCatalogPage.tsx
import { useMemo } from "react";
import { useTheses } from "@monteai/hooks";
import type { ThesisService } from "@monteai/api";
import { toThesisSummary } from "@monteai/types";
import type { ThesisActionType } from "@monteai/types";
import { ThesisCatalog, ThesisCatalogSkeleton } from "../components/Thesis";
import type { CatalogNotice } from "../components/Thesis";


interface ThesisCatalogPageProps {
  thesisService: ThesisService;
  onViewDetails?: (thesisId: string) => void;
  onSelectThesis?: (thesisId: string) => void;
  onThesisAction?: (thesisId: string, action: ThesisActionType) => void;
  /** Which moderation actions this viewer is allowed to take. Omit/empty for read-only roles (Student). */
  allowedActions?: ThesisActionType[];
  /** RBAC: render the upload CTA only for roles allowed to upload (Admin). */
  canUpload?: boolean;
  onUploadThesis?: () => void;
  onFilterClick?: () => void;
  /** Optional banner above the catalog (edit/delete results, load failures). */
  notice?: CatalogNotice | null;
  onDismissNotice?: () => void;
}

export function ThesisCatalogPage({
  thesisService,
  onViewDetails,
  onSelectThesis,
  onThesisAction,
  allowedActions = [],
  canUpload = false,
  onUploadThesis,
  notice = null,
  onDismissNotice,
  // onFilterClick, remove this comment if there will be future Filter features from the ThesisCatalog Component.
}: ThesisCatalogPageProps) {
  const { theses: rawTheses, isLoading } = useTheses(thesisService);

  const theses = useMemo(() => rawTheses.map(toThesisSummary), [rawTheses]);
  const featuredThesis = theses[0];

  const counts = useMemo(() => {
    const active = theses.filter((t) => t.status === "pending" || t.status === "revision").length;
    // "indexed" counts as archived: admin uploads land Indexed immediately
    // (no review step), so leaving it out would hide them from both buckets.
    const archived = theses.filter(
      (t) => t.status === "approved" || t.status === "rejected" || t.status === "indexed",
    ).length;
    return { active, archived };
  }, [theses]);

  if (isLoading || !featuredThesis) {
    return <ThesisCatalogSkeleton />;
  }

  return (
    <ThesisCatalog
      featuredThesis={featuredThesis}
      theses={theses}
      thesisData={rawTheses}
      counts={counts}
      isLoading={isLoading}
      onViewDetails={onViewDetails}
      onSelectThesis={onSelectThesis}
      onThesisAction={allowedActions.length ? onThesisAction : undefined}
      allowedActions={allowedActions}
      canUpload={canUpload}
      onUploadThesis={onUploadThesis}
      notice={notice}
      onDismissNotice={onDismissNotice}
      // onFilterClick={onFilterClick}
    />
  );
}