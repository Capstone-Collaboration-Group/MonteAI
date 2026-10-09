import { type AxiosInstance } from "axios";
import {
    type ResearchGroupResponseDto,
    type CreateResearchGroupDto,
    type UpdateResearchGroupDto,
} from "@monteai/types";
import { handle404 } from "@monteai/utils";

import type { ResearchGroupService } from "./types";

type ResultEnvelope = { result: boolean };
type CreateResultEnvelope = { result: ResearchGroupResponseDto };

export class LiveResearchGroupService implements ResearchGroupService {

    private readonly client: AxiosInstance
    constructor(client: AxiosInstance) {
        this.client = client;
    }

    async getResearchGroups(): Promise<ResearchGroupResponseDto[] | []> {
        try {
            const { data } = await this.client.get<ResearchGroupResponseDto[]>(`researchgroup`);
            return data;
        } catch (err) {
            return handle404(err, []);
        }
    }

    async getResearchGroup(researchGroupId: string): Promise<ResearchGroupResponseDto | null> {
        try {
            const { data } = await this.client.get<ResearchGroupResponseDto>(`researchgroup/${researchGroupId}`);
            return data;
        } catch (err) {
            return handle404(err, null);
        }
    }

    async createResearchGroup(dto: CreateResearchGroupDto): Promise<ResearchGroupResponseDto> {
        const { data } = await this.client.post<CreateResultEnvelope>(`researchgroup/create`, dto);
        if (!data?.result) throw new Error("Research group could not be created");
        return data.result;
    }

    async updateResearchGroup(researchGroupId: string, dto: UpdateResearchGroupDto): Promise<boolean> {
        try {
            const { data } = await this.client.patch<ResultEnvelope>(`researchgroup/update/${researchGroupId}`, dto);
            return data.result;
        } catch (err) {
            return handle404(err, false);
        }
    }

    async deleteResearchGroup(researchGroupId: string): Promise<boolean> {
        try {
            const { data } = await this.client.delete<ResultEnvelope>(`researchgroup/delete/${researchGroupId}`);
            return data.result;
        } catch (err) {
            return handle404(err, false);
        }
    }

    async addMember(researchGroupId: string, studentId: string): Promise<boolean> {
        const { data } = await this.client.post<ResultEnvelope>(`researchgroup/${researchGroupId}/members`, { studentId });
        return data.result;
    }

    async removeMember(researchGroupId: string, studentId: string): Promise<boolean> {
        const { data } = await this.client.delete<ResultEnvelope>(`researchgroup/${researchGroupId}/members/${studentId}`);
        return data.result;
    }
}
