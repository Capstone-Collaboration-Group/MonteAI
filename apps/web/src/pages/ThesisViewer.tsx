
import { useParams, useNavigate } from "react-router-dom";
import { ThesisPDFViewerPage } from "@monteai/ui/";
import { thesisService } from "../lib/thesisService";

export default function ThesisViewer() {
  const { thesisId } = useParams<{ thesisId: string }>();
  const navigate = useNavigate();

  if (!thesisId) return null;

  return (
    <ThesisPDFViewerPage
    thesisId={thesisId}
    thesisService={thesisService}
    role="student"  // swap for real role from auth
    onBack={() => navigate(-1)}
/>
  );
}