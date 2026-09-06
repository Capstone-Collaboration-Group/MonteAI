import { useQuery } from "@tanstack/react-query";
import type { AnnouncementService } from "@monteai/api";

export const announcementsKeys = {
    all: ["announcements"] as const,
    detail: (id: string) => ["announcements", id] as const,
};

export function useAnnouncements(
    announcementService: AnnouncementService
) {
    const query = useQuery({
        queryKey: announcementsKeys.all,
        queryFn: () => announcementService.getAnnouncements(),
        select: (data) => (Array.isArray(data) ? data : []),
    });

    return {
        ...query,
        announcements: query.data ?? [],
    };
}

export function useAnnouncement(
    announcementService: AnnouncementService,
    announcementId: string
) {
    const query = useQuery({
        queryKey: announcementsKeys.detail(announcementId),
        queryFn: () =>
            announcementService.getAnnouncement(announcementId),
        enabled: !!announcementId,
    });

    return {
        ...query,
        announcement: query.data ?? null,
    };
}