// packages/ui/src/pages/ThesisCatalogPage.tsx
import { useMemo } from "react";
import { useTheses } from "@monteai/hooks";
import type { ThesisService } from "@monteai/api";
import { ThesisActionType, toThesisSummary } from "@monteai/types";
import { ThesisCatalog, ThesisCatalogSkeleton } from "../components/Thesis";


interface ThesisCatalogPageProps {
  thesisService: ThesisService;
  onViewDetails?: (thesisId: string) => void;
  onSelectThesis?: (thesisId: string) => void;
  onThesisAction?: (thesisId: string, action: ThesisActionType) => void;
  /** Which moderation actions this viewer is allowed to take. Omit/empty for read-only roles (Student). */
  allowedActions?: ThesisActionType[];
  onFilterClick?: () => void;
}

export function ThesisCatalogPage({
  thesisService,
  onViewDetails,
  onSelectThesis,
  onThesisAction,
  allowedActions = [],
  // onFilterClick, remove this comment if there will be future Filter features from the ThesisCatalog Component.
}: ThesisCatalogPageProps) {
  const { theses: rawTheses, isLoading } = useTheses(thesisService);

  const theses = useMemo(() => rawTheses.map(toThesisSummary), [rawTheses]);
  const featuredThesis = theses[0];

  const counts = useMemo(() => {
    const active = theses.filter((t) => t.status === "pending" || t.status === "revision").length;
    const archived = theses.filter((t) => t.status === "approved" || t.status === "rejected").length;
    return { active, archived };
  }, [theses]);

  const healthStats = useMemo(() => {
    const total = theses.length;
    const approved = theses.filter((t) => t.status === "approved").length;
    return {
      approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
      yearLabel: new Date().getFullYear().toString(),
    };
  }, [theses]);

  if (isLoading || !featuredThesis) {
    return <ThesisCatalogSkeleton />;
  }

  return (
    <ThesisCatalog
      featuredThesis={featuredThesis}
      theses={theses}
      healthStats={healthStats}
      counts={counts}
      isLoading={isLoading}
      onViewDetails={onViewDetails}
      onSelectThesis={onSelectThesis}
      onThesisAction={allowedActions.length ? onThesisAction : undefined}
      allowedActions={allowedActions}
      // onFilterClick={onFilterClick}
    />
  );
}