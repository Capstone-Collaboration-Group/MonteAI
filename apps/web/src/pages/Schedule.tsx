import { SchedulePage } from "@monteai/ui";
import { useUserProfile } from "@monteai/hooks";
import { scheduleService } from "../lib/scheduleService";
import { facultyService } from "../lib/facultyService";
import { programHeadService } from "../lib/programHeadService";
import { adminService } from "../lib/adminService";
import { profileService } from "../lib/authService";

// Admin-only editing on the web — program heads get the view-only calendar
// here; their edit-schedule feature lives in the desktop app only (see
// apps/desktop/src/renderer/pages/Schedule.tsx, which keeps Admin ||
// ProgramHead for ScheduleController's Admin,ProgramHead write policy).
// Creation also lives in the thesis viewer's "Schedule For Defense" action.
export default function Schedule() {
  const { profile, isLoading } = useUserProfile(profileService);

  if (isLoading || !profile) {
    return <p>Loading...</p>;
  }

  const canEdit = profile.role === "Admin";

  return (
    <SchedulePage
      scheduleService={scheduleService}
      canEdit={canEdit}
      facultyService={facultyService}
      programHeadService={programHeadService}
      adminService={adminService}
    />
  );
}
