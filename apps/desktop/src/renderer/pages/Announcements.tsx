import { AnnouncementsPanel, INSTITUTES, type Institute } from "@monteai/ui";
import { useUserProfile } from "@monteai/hooks";
import { profileService } from "../lib/authServices";
import { announcementService } from "../lib/announcementService";

export default function Announcements() {
  const { profile, isLoading } = useUserProfile(profileService);

  if (isLoading || !profile) {
    return <p>Loading...</p>;
  }

  const role =
    profile.role === "Admin"
      ? "Admin"
      : profile.role === "ProgramHead" || profile.role === "Faculty"
        ? "ProgramHead"
        : "Student";

  const profileInstitute =
    "institute" in profile ? profile.institute : undefined;

  const userInstitute = INSTITUTES.includes(
    profileInstitute as Institute,
  )
    ? (profileInstitute as Institute)
    : undefined;

  return (
    <AnnouncementsPanel
      role={role}
      userInstitute={userInstitute}
      announcementService={announcementService}
    />
  );
} 