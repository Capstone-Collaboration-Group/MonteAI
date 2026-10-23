import { type AxiosInstance } from "axios";
import {
    type NotificationPageResponseDto,
} from "@monteai/types";

import type { NotificationService } from "./types";

export class LiveNotificationService implements NotificationService {
    private readonly client: AxiosInstance;
    constructor(client: AxiosInstance) {
        this.client = client;
    }

    async getNotifications(page = 1, pageSize = 20): Promise<NotificationPageResponseDto> {
        try {
            const { data } = await this.client.get<NotificationPageResponseDto>(
                `/notification?page=${page}&pageSize=${pageSize}`
            );
            return data;
        } catch {
            return { items: [], totalCount: 0, unreadCount: 0, page, pageSize };
        }
    }

    async getUnreadCount(): Promise<number> {
        try {
            const { data } = await this.client.get<{ unreadCount: number }>(
                `/notification/unread-count`
            );
            return data.unreadCount ?? 0;
        } catch {
            return 0;
        }
    }

    async markRead(notificationId: string): Promise<void> {
        await this.client.patch(`/notification/${notificationId}/read`);
    }

    async markAllRead(): Promise<void> {
        await this.client.patch(`/notification/read-all`);
    }
}
