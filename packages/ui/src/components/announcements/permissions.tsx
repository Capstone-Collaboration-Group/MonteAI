import type { Institute } from "./institutes";

export type UserRole = "Admin" | "ProgramHead" | "Student";

export interface AnnouncementPermissionContext {
  role: UserRole;
  userInstitute?: Institute;
  announcementInstitute?: Institute;
}

export interface AnnouncementPermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export function getAnnouncementPermissions({
  role,
  userInstitute,
  announcementInstitute,
}: AnnouncementPermissionContext): AnnouncementPermissions {
  if (role === "Admin") {
    return { canView: true, canCreate: true, canEdit: true, canDelete: true };
  }

  if (role === "ProgramHead") {
    const withinOwnInstitute =
      !announcementInstitute || announcementInstitute === userInstitute;

    return {
      canView: true,
      canCreate: true,
      canEdit: withinOwnInstitute,
      canDelete: withinOwnInstitute,
    };
  }

  return { canView: true, canCreate: false, canEdit: false, canDelete: false };
}
