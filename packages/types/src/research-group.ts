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
  /** Display name of the leader resolved server-side; fall back to leaderId when absent. */
  leaderName?: string;
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
