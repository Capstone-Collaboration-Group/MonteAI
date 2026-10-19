import type {
    NotificationPageResponseDto,
} from "@monteai/types";

export interface NotificationService {
    /** Paged notifications for the signed-in user (server scopes by token). */
    getNotifications(page?: number, pageSize?: number): Promise<NotificationPageResponseDto>;
    getUnreadCount(): Promise<number>;
    markRead(notificationId: string): Promise<void>;
    markAllRead(): Promise<void>;
}
