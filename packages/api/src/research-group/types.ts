import type{
    CreateResearchGroupDto,
    UpdateResearchGroupDto,
    ResearchGroupResponseDto
} from "@monteai/types";

export interface ResearchGroupService {
    getResearchGroups(): Promise<ResearchGroupResponseDto[] | []>;
    getResearchGroup(id: string): Promise<ResearchGroupResponseDto | null>;
    createResearchGroup(dto: CreateResearchGroupDto): Promise<ResearchGroupResponseDto>;
    updateResearchGroup(id: string, dto: UpdateResearchGroupDto): Promise<boolean>;
    deleteResearchGroup(id: string): Promise<boolean>;
}