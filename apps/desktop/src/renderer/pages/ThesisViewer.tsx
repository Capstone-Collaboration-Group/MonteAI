// apps/desktop/src/renderer/pages/ThesisViewer.tsx
import { useParams, useNavigate } from "react-router-dom";
import { ThesisPDFViewerPage } from "@monteai/ui/pages";
import { toViewerRole } from "@monteai/types";
import { useUserProfile } from "@monteai/hooks";
import { profileService } from "../lib/authServices";
import { thesisService } from "../lib/thesisService";
import { getAnnotationService } from "../lib/annotationService";
import { facultyService } from "../lib/facultyService";
import { programHeadService } from "../lib/programHeadService";
import { adminService } from "../lib/adminService";
import { scheduleService } from "../lib/scheduleService";

export default function ThesisViewer() {
  const { thesisId } = useParams<{ thesisId: string }>();
  const navigate = useNavigate();

  // Real role from the authenticated profile instead of a hardcoded value.
  const { profile, isLoading } = useUserProfile(profileService);

  if (!thesisId || isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white">
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
      />
    </div>
  );
}
