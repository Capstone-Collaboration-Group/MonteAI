import { SchedulePage } from "@monteai/ui";
import { useUserProfile } from "@monteai/hooks";
import { scheduleService } from "../lib/scheduleService";
import { facultyService } from "../lib/facultyService";
import { programHeadService } from "../lib/programHeadService";
import { adminService } from "../lib/adminService";
import { profileService } from "../lib/authServices";

export default function Schedule() {
  const { profile, isLoading } = useUserProfile(profileService);

  if (isLoading || !profile) {
    return <p>Loading...</p>;
  }

  return (
    <SchedulePage
      scheduleService={scheduleService}
      // Matches ScheduleController's write policy (Admin,ProgramHead).
      canEdit={profile.role === "Admin" || profile.role === "ProgramHead"}
      facultyService={facultyService}
      programHeadService={programHeadService}
      adminService={adminService}
    />
  );
}
