import { isAxiosError, type AxiosInstance } from "axios";
import { 
    type ThesisResponseDto,
    type SubmitThesisDto,
    type UpdateThesisDto,
    ThesisResponseListDto,
} from "@monteai/types";

import type { ThesisService } from "./types";


export class LiveThesisService implements ThesisService { 
    constructor(private readonly client: AxiosInstance) {}
    // async getThesis
    async getThesis(thesisId: string): Promise<ThesisResponseDto | null> { 
        try { 
            const { data } = await this.client.get<ThesisResponseDto>(`/thesis/${thesisId}`);
            return data;
        } catch (err: unknown) { 
            if(isAxiosError(err) && err.response?.status === 404) {
                return null
            }
            throw err;
        }
    }
    // async getTheses
    async getTheses(): Promise<ThesisResponseDto[] | []> { 
        try { 
            const { data } = await this.client.get<ThesisResponseListDto>(`/thesis`);
            return data;
        } catch (err:unknown) { 
            if(isAxiosError(err) && err.response?.status === 404) { 
                return [];
            }
            throw err;
        }
    }
    // async submitThesis
    async submitThesis(dto: SubmitThesisDto): Promise<ThesisResponseDto> { 
        const { data } =  await this.client.post<ThesisResponseDto>(`/thesis/submit`, dto);
        return data;
    }
    // async ingestThesis(No Embedding currently implemented)

    // async updateThesis
    async updateThesis(thesisId: string, dto: UpdateThesisDto): Promise<boolean> { 
        try { 
            const { data } = await this.client.patch<boolean>(`/thesis/update/details/${thesisId}`);
            return data;
        } catch (err: unknown) { 
            if(isAxiosError(err) && err.response?.status === 404) { 
                return false;
            } 
            throw err;
        }
    }
    // async updateThesisStatus
    async updateThesisStatus(thesisId: string, status: string): Promise<boolean> {
        try { 
            const { data } = await this.client.patch<boolean>(`/thesis/update/status/${thesisId}`);
            return data;
        } catch (err: unknown) { 
            if (isAxiosError(err) && err.response?.status === 404) { 
                return false;
            }
            throw err;
        }
    }
    // async deleteThesis 
    async deleteThesis(thesisId: string): Promise<boolean> {
        try { 
            const { data } = await this.client.delete<boolean>(`/thesis/delete/${thesisId}`);
            return data;
        } catch (err: unknown) { 
            if (isAxiosError(err) && err.response?.status === 404) { 
                return false;
            }
            throw err;
        }
    }
}
