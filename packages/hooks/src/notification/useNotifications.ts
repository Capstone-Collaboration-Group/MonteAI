import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationService } from "@monteai/api";

export const notificationKeys = {
    all: ["notifications"] as const,
    page: (page: number, pageSize: number) =>
        ["notifications", "page", page, pageSize] as const,
    unreadCount: ["notifications", "unread-count"] as const,
};

const DEFAULT_POLL_MS = 30_000;

/**
 * Paged in-app notifications for the signed-in user. Polls by design — there
 * is no push channel in this stack; pass `refetchIntervalMs: 0` to disable.
 */
export function useNotifications(
    notificationService: NotificationService,
    options?: { page?: number; pageSize?: number; refetchIntervalMs?: number }
) {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;

    const query = useQuery({
        queryKey: notificationKeys.page(page, pageSize),
        queryFn: () => notificationService.getNotifications(page, pageSize),
        refetchInterval: options?.refetchIntervalMs ?? DEFAULT_POLL_MS,
        refetchIntervalInBackground: false,
    });

    return {
        ...query,
        notifications: query.data?.items ?? [],
        unreadCount: query.data?.unreadCount ?? 0,
        totalCount: query.data?.totalCount ?? 0,
    };
}

/** Lightweight badge poll — use this when only the count is displayed. */
export function useUnreadNotificationCount(
    notificationService: NotificationService,
    refetchIntervalMs: number = DEFAULT_POLL_MS
) {
    const query = useQuery({
        queryKey: notificationKeys.unreadCount,
        queryFn: () => notificationService.getUnreadCount(),
        refetchInterval: refetchIntervalMs,
        refetchIntervalInBackground: false,
    });

    return { ...query, unreadCount: query.data ?? 0 };
}

export function useMarkNotificationRead(notificationService: NotificationService) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (notificationId: string) =>
            notificationService.markRead(notificationId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
        },
    });
}

export function useMarkAllNotificationsRead(notificationService: NotificationService) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => notificationService.markAllRead(),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
        },
    });
}
