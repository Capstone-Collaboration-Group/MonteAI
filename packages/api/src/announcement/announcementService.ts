import { type AxiosInstance } from "axios";
import { 
    type AnnouncementResponseDto,
    type CreateAnnouncementDto,
    type UpdateAnnouncementDto
} from "@monteai/types";
import { handle404 } from "@monteai/utils";

import type { AnnouncementService } from "./types";

export class LiveAnnouncementService implements AnnouncementService { 
    private readonly client: AxiosInstance;
    constructor(client: AxiosInstance) { 
        this.client = client;
    }

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
    async createAnnouncement(dto: CreateAnnouncementDto): Promise<void> { 
        await this.client.post<AnnouncementResponseDto>(`/announcement/create`, dto);
        
    }
    async updateAnnouncement(announcementId: string, dto: UpdateAnnouncementDto): Promise<void> { 
    
            await this.client.patch<boolean>(`/announcement/update/${announcementId}`, dto);
        }

    async deleteAnnouncement(announcementId: string): Promise<void> { 
         await this.client.delete<boolean>(`/announcement/delete/${announcementId}`);
    
    }
    
}