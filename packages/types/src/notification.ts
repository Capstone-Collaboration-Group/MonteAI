export type NotificationType =
  | "GroupAdded"
  | "GroupRemoved"
  | "DefenseScheduled"
  | "DefenseRescheduled"
  | "DefenseCancelled"
  | "PanelistAssigned"
  | "Announcement";

/** What the notification deep-links to; each app maps this to its own router. */
export type NotificationTargetType = "research_group" | "schedule" | "announcement";

export interface NotificationResponseDto {
  id: string;
  type: NotificationType | string;
  title: string;
  body: string;
  targetType: NotificationTargetType | string;
  /** Guid of the target (group/schedule/announcement) as a string. */
  targetId?: string | null;
  isRead: boolean;
  /** ISO timestamp. */
  createdAt: string;
}

export interface NotificationPageResponseDto {
  items: NotificationResponseDto[];
  totalCount: number;
  unreadCount: number;
  page: number;
  pageSize: number;
}
