import { type AxiosInstance } from "axios";
import { 
    type ThesisResponseDto,
    type SubmitThesisDto,
    type UpdateThesisDto,
    type IngestThesisDto,
    type IngestThesisResponseDto
} from "@monteai/types";
import { handle404 } from "@monteai/utils"

import type { ThesisService } from "./types";


export class LiveThesisService implements ThesisService { 
    constructor(private readonly client: AxiosInstance) {}
    // async getThesis
    async getThesis(thesisId: string): Promise<ThesisResponseDto | null> { 
        try { 
            const { data } = await this.client.get<ThesisResponseDto>(`/thesis/${thesisId}`);
            return data;
        } catch (err) { 
            return handle404(err, null);
        }
    }
    // async getTheses
    async getTheses(): Promise<ThesisResponseDto[] | []> { 
        try { 
            const { data } = await this.client.get<ThesisResponseDto[]>(`/thesis`);
            return data;
        } catch (err) { 
            return handle404(err, []);
        }
    }
    // async submitThesis
    async submitThesis(dto: SubmitThesisDto): Promise<ThesisResponseDto> { 
        const { data } =  await this.client.post<ThesisResponseDto>(`/thesis/submit`, dto);
        return data;
    }
    // async ingestThesis(No Embedding currently implemented)
     async ingestThesis(dto: IngestThesisDto): Promise<IngestThesisResponseDto> {
            const { data } = await this.client.post<IngestThesisResponseDto>(
                `/thesis/ingest`,
                dto,
            );
        return data;
    }
    async getDownloadUrl(thesisId: string): Promise<{url: string} | null> {
        try { 
            const { data } = await this.client.get<{url: string}>(`/thesis/${thesisId}/download-url`);
            
            return data;
        } catch(err) { 
            return handle404(err, null);
        }
    }

    // async updateThesis
    async updateThesis(thesisId: string, dto: UpdateThesisDto): Promise<boolean> { 
        try { 
            const { data } = await this.client.patch<boolean>(`/thesis/update/details/${thesisId}`, dto);
            return data;
        } catch (err) { 
            return handle404(err, false);
        }
    }
    // async updateThesisStatus
    async updateThesisStatus(thesisId: string, status: string): Promise<boolean> {
        try { 
            const { data } = await this.client.patch<boolean>(`/thesis/update/status/${thesisId}`, { status}, );
            return data;
        } catch (err) { 
            return handle404(err, false);
            }

        }
    
    // async deleteThesis 
    async deleteThesis(thesisId: string): Promise<boolean> {
        try { 
            const { data } = await this.client.delete<boolean>(`/thesis/delete/${thesisId}`);
            return data;
        } catch (err) { 
            return handle404(err, false);
        }
    }
   
}
