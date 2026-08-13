// apps/desktop/src/renderer/pages/ThesisViewer.tsx
import { useParams, useNavigate } from "react-router-dom";
import { ThesisPDFViewerPage } from "@monteai/ui/pages";
import { thesisService } from "../lib/thesisService";

export default function ThesisViewer() {
  const { thesisId } = useParams<{ thesisId: string }>();
  const navigate = useNavigate();

  if (!thesisId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white">
      <ThesisPDFViewerPage
        thesisId={thesisId}
        thesisService={thesisService}
        role="adviser"
        onBack={() => navigate(-1)}
      />
    </div>
  );
}