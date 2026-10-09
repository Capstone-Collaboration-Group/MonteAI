import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ThesisPDFViewerPage } from "@monteai/ui/";
import { toViewerRole } from "@monteai/types";
import { useUserProfile } from "@monteai/hooks";
import { thesisService } from "../lib/thesisService";
import { profileService } from "../lib/authService";
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

  // Real role from the authenticated profile (ProtectedRoute already blocks
  // until the profile query resolves, so this is served from cache).
  const { profile, isLoading } = useUserProfile(profileService);

  if (!thesisId || isLoading) return null;

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
      role={toViewerRole(profile?.role)}
      // Ownership for the delete button: leader of THIS thesis's group only.
      isGroupLeader={profile?.role === "Student" && profile.position === "Leader"}
      currentGroupId={
        profile?.role === "Student" ? (profile.researchGroup?.id ?? null) : null
      }
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
