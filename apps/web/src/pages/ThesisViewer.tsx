import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ThesisPDFViewerPage } from "@monteai/ui/";
import { thesisService } from "../lib/thesisService";
import { getAnnotationService } from "../lib/annotationService";
import { facultyService } from "../lib/facultyService";
import { programHeadService } from "../lib/programHeadService";
import { adminService } from "../lib/adminService";
import { scheduleService } from "../lib/scheduleService";
import { ThesisSubmissionModal } from "../components/ThesisSubmissionModal";


export default function ThesisViewer() {
  const { thesisId } = useParams<{ thesisId: string }>();
  const navigate = useNavigate();
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);

  if (!thesisId) return null;

  return (
    <>
    <ThesisPDFViewerPage
    thesisId={thesisId}
    thesisService={thesisService}
    annotationService={getAnnotationService()}
    facultyService={facultyService}
    programHeadService={programHeadService}
    adminService={adminService}
    scheduleService={scheduleService}
    role="student"  // swap for real role from auth
    onBack={() => navigate(-1)}
    onSubmitRevision={() => setRevisionModalOpen(true)}
/>
<ThesisSubmissionModal
      open={revisionModalOpen}
      onClose={() => setRevisionModalOpen(false)}
      mode="revision"
      thesisId={thesisId}
    />
  </>
  );
}