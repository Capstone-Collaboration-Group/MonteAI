import { type AxiosInstance } from "axios";
import {
    type ResearchGroupResponseDto,
    type CreateResearchGroupDto,
    type UpdateResearchGroupDto,
} from "@monteai/types";
import { handle404 } from "@monteai/utils";

import type { ResearchGroupService } from "./types";

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
        const { data } = await this.client.post<ResearchGroupResponseDto>(`researchgroup/create`, dto);
        return data;
    }

    async updateResearchGroup(researchGroupId: string, dto: UpdateResearchGroupDto): Promise<boolean> {
        try {
            const { data } = await this.client.patch<boolean>(`researchgroup/update/${researchGroupId}`, dto);
            return data;
        } catch (err) {
            return handle404(err, false);
        }
    }

    async deleteResearchGroup(researchGroupId: string): Promise<boolean> {
        try {
            const { data } = await this.client.delete<boolean>(`researchgroup/delete/${researchGroupId}`);
            return data;
        } catch (err) {
            return handle404(err, false);
        }
    }
}