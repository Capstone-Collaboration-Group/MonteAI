import type {
    CreateResearchGroupDto,
    UpdateResearchGroupDto,
    ResearchGroupResponseDto,
    ResearchGroupInvitationDto
} from "@monteai/types";

export interface ResearchGroupService {
    getResearchGroups(): Promise<ResearchGroupResponseDto[] | []>;
    getResearchGroup(id: string): Promise<ResearchGroupResponseDto | null>;
    createResearchGroup(dto: CreateResearchGroupDto): Promise<ResearchGroupResponseDto>;
    updateResearchGroup(id: string, dto: UpdateResearchGroupDto): Promise<boolean>;
    deleteResearchGroup(id: string): Promise<boolean>;
    sendInvitation(id: string, studentId: string): Promise<boolean>;
    acceptInvitation(id: string, studentId: string): Promise<boolean>;
    declineInvitation(id: string, studentId: string): Promise<boolean>;
    cancelInvitation(id: string, studentId: string): Promise<boolean>;
    getInvitations(id: string): Promise<ResearchGroupInvitationDto[]>;
    removeMember(id: string, studentId: string): Promise<boolean>;
}
