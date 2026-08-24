// apps/web/src/pages/student/Theses.tsx
import { ThesisCatalogPage } from "@monteai/ui";
import { thesisService } from "../lib/thesisService";
import { useNavigate } from "react-router-dom";

export default function Theses() {
  const navigate = useNavigate();

  return (
    <ThesisCatalogPage
      thesisService={thesisService}
      onViewDetails={(thesisId) => navigate(`/thesis/view/${thesisId}`)}
      // no allowedActions, no onThesisAction — students browse only
    />
  );
}