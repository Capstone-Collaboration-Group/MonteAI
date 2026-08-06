// packages/api/src/program-head/mockProgramHeadService.ts

import type { ProgramHeadService } from "./types";
import type {
  ProgramHeadResponseDto,
  CreateProgramHeadDto,
  UpdateProgramHeadDto,
} from "@monteai/types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log("mockProgramHeadService loaded — Initialized with seed data");

function buildSeed(): ProgramHeadResponseDto[] {
  return [
    {
      id: "program-head-1",
      email: "roland.balmes@monteai.edu",
      firstName: "Roland",
      middleInitial: "A",
      lastName: "Balmes",
      suffix: "",
      role: "Program Head",
      isActive: true,
      institute: "Institute of Computing Studies",
      programHandled: "BS Information Technology",
      createdAt: "2025-01-10T08:00:00.000Z",
      updatedAt: "2025-01-10T08:00:00.000Z",
    },
    {
      id: "program-head-2",
      email: "ana.reyes@monteai.edu",
      firstName: "Ana",
      middleInitial: "M",
      lastName: "Reyes",
      suffix: "",
      role: "Program Head",
      isActive: true,
      institute: "Institute of Computing Studies",
      programHandled: "BS Computer Science",
      createdAt: "2025-01-12T09:00:00.000Z",
      updatedAt: "2025-01-12T09:00:00.000Z",
    },
    {
      id: "program-head-3",
      email: "carlo.santos@monteai.edu",
      firstName: "Carlo",
      middleInitial: "D",
      lastName: "Santos",
      suffix: "",
      role: "Program Head",
      isActive: true,
      institute: "Institute of Engineering",
      programHandled: "BS Computer Engineering",
      createdAt: "2025-01-15T10:30:00.000Z",
      updatedAt: "2025-01-15T10:30:00.000Z",
    },
  ];
}

const programHeadsMap = new Map<string, ProgramHeadResponseDto>();

buildSeed().forEach((programHead) =>
  programHeadsMap.set(programHead.id, programHead)
);

export const mockProgramHeadService: ProgramHeadService = {
  async getProgramHeads() {
    await delay(300);
    return Array.from(programHeadsMap.values());
  },

  async getProgramHead(programHeadId: string) {
    await delay(150);
    return programHeadsMap.get(programHeadId) ?? null;
  },

  async createProgramHead(dto: CreateProgramHeadDto) {
    await delay(300);

    const now = new Date().toISOString();

    const programHead: ProgramHeadResponseDto = {
      id: dto.id || crypto.randomUUID(),
      email: dto.email,
      firstName: dto.firstName,
      middleInitial: dto.middleInitial,
      lastName: dto.lastName,
      suffix: dto.suffix,
      role: "Program Head",
      isActive: true,
      institute: dto.institute,
      programHandled: dto.programHandled,
      createdAt: now,
      updatedAt: now,
    };

    programHeadsMap.set(programHead.id, programHead);

    return programHead;
  },

  async updateProgramHead(
    programHeadId: string,
    dto: UpdateProgramHeadDto
  ) {
    await delay(300);

    const existing = programHeadsMap.get(programHeadId);

    if (!existing) {
      return false;
    }

    programHeadsMap.set(programHeadId, {
      ...existing,
      ...dto,
      updatedAt: new Date().toISOString(),
    });

    return true;
  },

  async deleteProgramHead(programHeadId: string) {
    await delay(200);
    return programHeadsMap.delete(programHeadId);
  },
};