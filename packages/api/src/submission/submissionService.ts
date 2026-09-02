import { type AxiosInstance } from "axios";
import type { 
    CreateSubmissionDto,
    UpdateSubmissionDto,
    SubmissionResponseDto
} from "@monteai/types";
import type { SubmissionService } from "./types";
import { handle404 } from "@monteai/utils";

export class LiveSubmissionService implements SubmissionService  { 
    private readonly client: AxiosInstance;
    constructor (client: AxiosInstance) {
        this.client = client;
    }

    async getSubmissions(): Promise<SubmissionResponseDto[] | []> {
        try { 
            const { data } = await this.client.get<SubmissionResponseDto[]>(`/submission`);
            return data;
        } catch (err) { 
            return handle404(err, []);
        }
    }
    
    async getSubmission(submissionId: string): Promise<SubmissionResponseDto | null> {
        try { 
            const { data } = await this.client.get<SubmissionResponseDto>(`/submission/${submissionId}`);
            return data;
        } catch (err) { 
            return handle404(err, null);
        }
    }

    async createSubmission(dto: CreateSubmissionDto): Promise<boolean> { 
        const { data } = await this.client.post<boolean>(`/submission/create`, dto);
        return data;
    }

    async updateSubmission(submissionId: string, dto: UpdateSubmissionDto): Promise<boolean> {
        try { 
            const { data } = await this.client.patch<boolean>(`/submission/update/${submissionId}`, dto);
            return data;
        } catch (err){ 
            return handle404(err, false);
        }
    }

    async deleteSubmission(submissionId: string): Promise<boolean> {
        try { 
            const { data } = await this.client.delete<boolean>(`/submission/delete/${submissionId}`);
            return data;
        } catch (err){ 
            return handle404(err, false);
        }
    }
}