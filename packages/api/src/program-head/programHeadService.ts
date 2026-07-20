import { type AxiosInstance } from "axios";
import {
    type ProgramHeadResponseDto,
    type CreateProgramHeadDto,
    type UpdateProgramHeadDto,
} from "@monteai/types";
import { handle404 } from "@monteai/utils";

import { ProgramHeadService } from "./types";

export class LiveProgramHeadService implements ProgramHeadService {
    constructor(private readonly client: AxiosInstance) {}

    async getProgramHeads(): Promise<ProgramHeadResponseDto[] | []> {
        try {
            const { data } = await this.client.get<ProgramHeadResponseDto[]>(`programhead`);
            return data;
        } catch (err) {
            return handle404(err, []);
        }
    }

    async getProgramHead(programHeadId: string): Promise<ProgramHeadResponseDto | null> {
        try {
            const { data } = await this.client.get<ProgramHeadResponseDto>(`programhead/${programHeadId}`);
            return data;
        } catch (err) {
            return handle404(err, null);
        }
    }

    async createProgramHead(dto: CreateProgramHeadDto): Promise<ProgramHeadResponseDto> {
        const { data } = await this.client.post<ProgramHeadResponseDto>(`programhead/create`, dto);
        return data;
    }

    async updateProgramHead(programHeadId: string, dto: UpdateProgramHeadDto): Promise<boolean> {
        try {
            const { data } = await this.client.post<boolean>(`programhead/update/${programHeadId}`, dto);
            return data;
        } catch (err) {
            return handle404(err, false);
        }
    }

    async deleteProgramHead(programHeadId: string): Promise<boolean> {
        try {
            const { data } = await this.client.post<boolean>(`programhead/delete/${programHeadId}`);
            return data;
        } catch (err) {
            return handle404(err, false);
        }
    }
}