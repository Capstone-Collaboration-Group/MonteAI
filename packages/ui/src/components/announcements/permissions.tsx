export type UserRole = "Admin" | "ProgramHead" | "Student";

export interface AnnouncementPermissionContext {
  role: UserRole;
  userInstitute?: string;
  announcementInstitute?: string;
  currentUserId?: string;
  announcementAuthorId?: string;
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
  currentUserId,
  announcementAuthorId,
}: AnnouncementPermissionContext): AnnouncementPermissions {
  if (role === "Admin") {
    return { canView: true, canCreate: true, canEdit: true, canDelete: true };
  }

  if (role === "ProgramHead") {
    const isOwnAnnouncement = currentUserId && announcementAuthorId
      ? currentUserId === announcementAuthorId
      : false;
    const withinOwnInstitute =
      !userInstitute || !announcementInstitute || announcementInstitute === userInstitute;

    return {
      canView: true,
      canCreate: true,
      canEdit: withinOwnInstitute && isOwnAnnouncement,
      canDelete: withinOwnInstitute && isOwnAnnouncement,
    };
  }

  return { canView: true, canCreate: false, canEdit: false, canDelete: false };
}
