// packages/ui/src/pages/ThesisCatalogPage.tsx
import { useMemo } from "react";
import { useTheses } from "@monteai/hooks";
import type { ThesisService } from "@monteai/api";
import { toThesisSummary } from "@monteai/types";
import { ThesisCatalog, ThesisCatalogSkeleton } from "../components/Thesis";

interface ThesisCatalogPageProps {
  thesisService: ThesisService;
  onViewDetails?: (thesisId: string) => void;
  onSelectThesis?: (thesisId: string) => void;
 onThesisAction?: (thesisId: string, action: "approve" | "reject" | "revision") => void;
  onFilterClick?: () => void;
}

export function ThesisCatalogPage({
  thesisService,
  onViewDetails,
  onSelectThesis,
  onThesisAction,
  onFilterClick,
}: ThesisCatalogPageProps) {
  const result = useTheses(thesisService);

const { theses: rawTheses, isLoading } = result;
  

  const theses = useMemo(() => {
    const mapped = rawTheses.map(toThesisSummary);
    console.log('[DEBUG] mapped theses:', mapped);
    return mapped;
}, [rawTheses]);

  const featuredThesis = theses[0];

  const counts = useMemo(() => {
    const active = theses.filter((t) => t.status === "pending" || t.status === "revision").length;
    const archived = theses.filter((t) => t.status === "approved" || t.status === "rejected").length;
    return { active, archived };
  }, [theses]);

  const healthStats = useMemo(() => {
    const total = theses.length;
    const approved = theses.filter((t) => t.status === "approved").length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
    return {
      approvalRate,
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
      onThesisAction={onThesisAction}

    />
  );
}