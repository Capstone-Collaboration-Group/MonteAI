import type { 
    AnnouncementResponseDto,
    CreateAnnouncementDto,
    UpdateAnnouncementDto,
} from "@monteai/types";

export interface AnnouncementService { 
    getAnnouncements(): Promise<AnnouncementResponseDto[]>;
    getAnnouncement(announcementId: string): Promise<AnnouncementResponseDto | null>;
    createAnnouncement(dto: CreateAnnouncementDto): Promise<void>;
    updateAnnouncement(announcementId: string,dto: UpdateAnnouncementDto): Promise<void>;
    deleteAnnouncement(announcementId: string): Promise<void>;
}