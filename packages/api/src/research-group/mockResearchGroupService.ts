// packages/api/src/research-group/mockResearchGroupService.ts

import type { ResearchGroupService } from "./types";
import type {
  ResearchGroupResponseDto,
  CreateResearchGroupDto,
  UpdateResearchGroupDto,
} from "@monteai/types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log("mockResearchGroupService loaded — Initialized with seed data");

function buildSeed(): ResearchGroupResponseDto[] {
  return [
    {
      id: "research-group-1",
      groupName: "Group Alpha",
      institute: 'ics',
      researchTitle: "AI-Driven Student Performance Prediction",
      adviserId: "faculty-1",
      leaderId: "student-1",
      createdAt: "2025-01-10T08:00:00.000Z",
      updatedAt: "2025-01-10T08:00:00.000Z",
      members: [{ id: "student-1", studentNumber: "2025-0001", name: "Student One", position: "Leader", program: "BSCS" }],
      
    },
    {
      id: "research-group-2",
      groupName: "Group Beta",
      institute: 'ics',
      researchTitle: "Smart Attendance Monitoring System",
      adviserId: "faculty-2",
      leaderId: "student-2",
      createdAt: "2025-01-15T09:30:00.000Z",
      updatedAt: "2025-01-15T09:30:00.000Z",
      members: [{ id: "student-2", studentNumber: "2025-0002", name: "Student Two", position: "Leader", program: "BSIT" }],
      
    },
    {
      id: "research-group-3",
      groupName: "Group Gamma",
      institute: 'ics',
      researchTitle: "Blockchain-Based Academic Records Management",
      adviserId: "faculty-3",
      leaderId: "student-3",
      createdAt: "2025-01-20T10:15:00.000Z",
      updatedAt: "2025-01-20T10:15:00.000Z",
      members: [{ id: "student-3", studentNumber: "2025-0003", name: "Student Three", position: "Leader", program: "BSCS" }],
    },
  ];
}

const researchGroupsMap = new Map<string, ResearchGroupResponseDto>();

buildSeed().forEach((group) =>
  researchGroupsMap.set(group.id, group)
);

export const mockResearchGroupService: ResearchGroupService = {
  async getResearchGroups() {
    await delay(300);
    return Array.from(researchGroupsMap.values());
  },

  async getResearchGroup(id: string) {
    await delay(150);
    return researchGroupsMap.get(id) ?? null;
  },

  async createResearchGroup(dto: CreateResearchGroupDto) {
    await delay(300);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const institute = 'ibe';
    const leaderId = dto.leaderId ?? `student-${id.slice(0, 8)}`;
    const researchGroup: ResearchGroupResponseDto = {
      id,
      groupName: dto.groupName,
      institute: institute,
      researchTitle: dto.researchTitle,
      adviserId: dto.adviserId ?? "",
      leaderId,
      createdAt: now,
      updatedAt: now,
      members: [{ id: leaderId, studentNumber: leaderId, name: leaderId, position: "Leader", program: "" }],
    };

    researchGroupsMap.set(id, researchGroup);

    return researchGroup;
  },

  async updateResearchGroup(
    id: string,
    dto: UpdateResearchGroupDto
  ) {
    await delay(300);

    const existing = researchGroupsMap.get(id);

    if (!existing) {
      return false;
    }

    researchGroupsMap.set(id, {
      ...existing,
      ...dto,
      updatedAt: new Date().toISOString(),
    });

    return true;
  },

  async deleteResearchGroup(id: string) {
    await delay(200);
    return researchGroupsMap.delete(id);
  },

  async addMember(id: string, studentId: string) {
    await delay(200);
    const group = researchGroupsMap.get(id);
    if (!group || group.members.length >= 4) return false;
    if (group.members.some((member) => member.id === studentId)) return false;
    group.members = [...group.members, { id: studentId, studentNumber: studentId, name: studentId, position: "Member", program: "" }];
    return true;
  },

  async removeMember(id: string, studentId: string) {
    await delay(200);
    const group = researchGroupsMap.get(id);
    if (!group || group.leaderId === studentId) return false;
    group.members = group.members.filter((member) => member.id !== studentId);
    return true;
  },
};
