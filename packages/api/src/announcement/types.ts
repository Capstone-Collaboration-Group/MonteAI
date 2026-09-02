import type { 
    AnnouncementResponseDto,
    CreateAnnouncementDto,
    UpdateAnnouncementDto,
} from "@monteai/types";

export interface AnnouncementService { 
    getAnnouncements(): Promise<AnnouncementResponseDto[]>;
    getAnnouncement(announcementId: string): Promise<AnnouncementResponseDto | null>;
    createAnnouncement(dto: CreateAnnouncementDto): Promise<AnnouncementResponseDto>;
    updateAnnouncement(announcementId: string, dto: UpdateAnnouncementDto): Promise<boolean>;
    deleteAnnouncement(announcementId: string): Promise<boolean>;
}