// apps/desktop/src/renderer/pages/Theses.tsx
import { ThesisCatalogPage } from "@monteai/ui/pages";
import { useApproveThesis } from "@/hooks/useApproveThesis";
import { useRequestRevision } from "@/hooks/useRequestRevision";
import { useRejectThesis } from "@/hooks/useRejectThesis";
import { thesisService } from "../lib/thesisService";
import { useNavigate } from "react-router-dom";

export default function Theses() {
  const navigate = useNavigate();
  const { mutate: approve } = useApproveThesis();
  const { mutate: revision } = useRequestRevision();
  const { mutate: reject } = useRejectThesis();

  const handleThesisAction = (thesisId: string, action: "approve" | "reject" | "revision") => {
    if (action === "approve") approve({ thesisId });
    if (action === "reject") reject({ thesisId });
    if (action === "revision") revision({ thesisId });
  };

  return (
    <ThesisCatalogPage
      thesisService={thesisService}
      allowedActions={["approve", "reject", "revision"]}
      onViewDetails={(thesisId) => navigate(`/thesis/view/${thesisId}`)}
      onThesisAction={handleThesisAction}
    />
  );
}