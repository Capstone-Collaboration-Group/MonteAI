// apps/desktop/src/renderer/pages/Theses.tsx (or wherever your page is)
import { ThesisCatalogPage } from "@monteai/ui/pages";
import { useApproveThesis } from "@/hooks/useApproveThesis";
import { useTheses } from "@monteai/hooks";
import { thesisService } from "../lib/thesisService";

export default function Theses() {
    const { data: rawTheses = [] }       = useTheses(thesisService);
    const { mutate: approve, isPending } = useApproveThesis();

    const handleThesisAction = (thesisId: string) => {
        // rawTheses still has filePath — use this instead of mapped summaries
        const thesis = rawTheses.find(t => t.id === thesisId);

        console.log('[DEBUG] found thesis:', thesis);

        if (!thesis?.filePath) {
            console.warn('[DEBUG] filePath missing for thesisId:', thesisId);
            return;
        }

        approve({ thesisId, filePath: thesis.filePath });
    };

    return (
        <ThesisCatalogPage
            thesisService={thesisService}
            onThesisAction={handleThesisAction}
        />
    );
}