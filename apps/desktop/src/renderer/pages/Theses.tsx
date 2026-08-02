// apps/desktop/src/renderer/pages/Theses.tsx
import { ThesisCatalogPage } from "@monteai/ui/pages";
import { useApproveThesis } from "@/hooks/useApproveThesis";
import { thesisService } from "../lib/thesisService";

export default function Theses() {
    const { mutate: approve } = useApproveThesis();

    const handleThesisAction = (thesisId: string) => {
        approve({ thesisId });
    };

    return (
        <ThesisCatalogPage
            thesisService={thesisService}
            onThesisAction={handleThesisAction}
        />
    );
}