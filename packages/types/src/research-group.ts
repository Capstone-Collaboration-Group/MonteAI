export interface CreateResearchGroupDto {
  groupName: string;
  researchTitle: string;
  adviserId?: string;
  leaderId?: string;
}

export interface UpdateResearchGroupDto {
  groupName?: string;
  researchTitle?: string;
  adviserId?: string;
  leaderId?: string;
}

export interface ResearchGroupResponseDto {
  id: string;
  groupName: string;
  researchTitle: string;
  adviserId: string;
  leaderId: string;
  createdAt: string;
  updatedAt: string;
  institute: string;
  members: ResearchGroupMemberDto[];
}

export interface ResearchGroupMemberDto {
  id: string;
  studentNumber: string;
  name: string;
  position: string;
  program: string;
}

export type ResearchGroupResponseListDto = ResearchGroupResponseDto[];
