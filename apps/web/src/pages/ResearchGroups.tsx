import { ResearchGroupPage } from "@monteai/ui";
import { useUserProfile } from "@monteai/hooks";
import { researchGroupService } from "../lib/researchGroupService";
import { studentService } from "../lib/studentService";
import { facultyService } from "../lib/facultyService";
import { profileService } from "../lib/authService";

export default function ResearchGroups() {
  const { profile } = useUserProfile(profileService);

  return (
    <ResearchGroupPage
      researchGroupService={researchGroupService}
      studentService={studentService}
      facultyService={facultyService}
      role={profile?.role}
    />
  );
}
