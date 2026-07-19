import { type AxiosInstance } from "axios";
import { 
    type AnnouncementResponseDto,
    type CreateAnnouncementDto,
    type UpdateAnnouncementDto
} from "@monteai/types";
import { handle404 } from "@monteai/utils";

import { AnnouncementService } from "./types";

export class LiveAnnouncementService implements AnnouncementService { 
    constructor(private readonly client: AxiosInstance) {}

    async getAnnouncements(): Promise<AnnouncementResponseDto[] | []> { 
        try { 
            const { data } = await this.client.get<AnnouncementResponseDto[]>(`/announcement`);
            return data;
        } catch (err) { 
           return handle404(err, []);
        }
    }

    async getAnnouncement(announcementId: string): Promise<AnnouncementResponseDto | null> { 
        try { 
            const { data } = await this.client.get<AnnouncementResponseDto>(`/announcement/${announcementId}`);
            return data;
        } catch (err) { 
            return handle404(err, null);
        }
    }
    async createAnnouncement(dto: CreateAnnouncementDto): Promise<AnnouncementResponseDto> { 
        const { data } = await this.client.post<AnnouncementResponseDto>(`/announcement/create`, dto);
        return data;
    }
    async updateAnnouncement(announcementId: string, dto: UpdateAnnouncementDto): Promise<boolean> { 
        try { 
            const { data } = await this.client.patch<boolean>(`/announcement/update/${announcementId}`, dto);
            return data;
        } catch (err) { 
            return handle404(err, false);
        }
    }
    async deleteAnnouncement(announcementId: string): Promise<boolean> { 
        try { 
            const { data } = await this.client.delete<boolean>(`/announcement/delete/${announcementId}`);
            return data;
        } catch (err) { 
            return handle404(err, false);
        }
    }
    
}