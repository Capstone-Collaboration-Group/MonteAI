// packages/api/src/notification/mockNotificationService.ts

import type { NotificationService } from "./types";
import type { NotificationPageResponseDto, NotificationResponseDto } from "@monteai/types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSeed(): NotificationResponseDto[] {
  const now = Date.now();
  const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();

  return [
    {
      id: "notif-1",
      type: "DefenseScheduled",
      title: "Defense scheduled",
      body: 'You are scheduled for the thesis defense of "Group A" on March 5, 2026, 9:00 AM–11:00 AM at Room 101.',
      targetType: "schedule",
      targetId: "00000000-0000-0000-0000-000000000001",
      isRead: false,
      createdAt: iso(12),
    },
    {
      id: "notif-2",
      type: "Announcement",
      title: "Thesis Submission Deadline",
      body: "The deadline for thesis proposal submission is on September 15. Please upload all required documents before the deadline.",
      targetType: "announcement",
      targetId: "announcement-2",
      isRead: false,
      createdAt: iso(90),
    },
    {
      id: "notif-3",
      type: "GroupAdded",
      title: "Added to a research group",
      body: 'You have been added to research group "Group A" — Smart Monitoring System.',
      targetType: "research_group",
      targetId: "00000000-0000-0000-0000-000000000002",
      isRead: true,
      createdAt: iso(1440),
    },
  ];
}

const notifications = buildSeed();

export const mockNotificationService: NotificationService = {
  async getNotifications(page = 1, pageSize = 20): Promise<NotificationPageResponseDto> {
    await delay(250);
    const sorted = [...notifications].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
    const start = (page - 1) * pageSize;
    return {
      items: sorted.slice(start, start + pageSize),
      totalCount: sorted.length,
      unreadCount: sorted.filter((n) => !n.isRead).length,
      page,
      pageSize,
    };
  },

  async getUnreadCount(): Promise<number> {
    await delay(150);
    return notifications.filter((n) => !n.isRead).length;
  },

  async markRead(notificationId: string): Promise<void> {
    await delay(150);
    const target = notifications.find((n) => n.id === notificationId);
    if (target) target.isRead = true;
  },

  async markAllRead(): Promise<void> {
    await delay(200);
    notifications.forEach((n) => {
      n.isRead = true;
    });
  },
};
