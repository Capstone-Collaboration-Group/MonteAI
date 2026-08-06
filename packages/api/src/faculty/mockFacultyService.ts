// packages/api/src/faculty/mockFacultyService.ts

import type { FacultyService } from "./types";
import type {
  FacultyResponseDto,
  CreateFacultyDto,
  UpdateFacultyDto,
} from "@monteai/types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log("mockFacultyService loaded — Initialized with seed data");

function buildSeed(): FacultyResponseDto[] {
  return [
    {
      id: "faculty-1",
      email: "roland.balmes@monteai.edu",
      firstName: "Roland",
      middleInitial: "A",
      lastName: "Balmes",
      suffix: "",
      role: "Professor",
      institute: "Institute of Computing Studies",
      isActive: true,
      createdAt: "2025-01-10T08:00:00.000Z",
      updatedAt: "2025-01-10T08:00:00.000Z",
    },
    {
      id: "faculty-2",
      email: "ana.reyes@monteai.edu",
      firstName: "Ana",
      middleInitial: "M",
      lastName: "Reyes",
      suffix: "",
      role: "Associate Professor",
      institute: "Institute of Computing Studies",
      isActive: true,
      createdAt: "2025-01-12T09:00:00.000Z",
      updatedAt: "2025-01-12T09:00:00.000Z",
    },
    {
      id: "faculty-3",
      email: "carlo.santos@monteai.edu",
      firstName: "Carlo",
      middleInitial: "D",
      lastName: "Santos",
      suffix: "",
      role: "Assistant Professor",
      institute: "Institute of Computing Studies",
      isActive: true,
      createdAt: "2025-01-15T10:30:00.000Z",
      updatedAt: "2025-01-15T10:30:00.000Z",
    },
  ];
}

const facultiesMap = new Map<string, FacultyResponseDto>();

buildSeed().forEach((faculty) => facultiesMap.set(faculty.id, faculty));

export const mockFacultyService: FacultyService = {
  async getFaculties() {
    await delay(300);
    return Array.from(facultiesMap.values());
  },

  async getFaculty(facultyId: string) {
    await delay(150);
    return facultiesMap.get(facultyId) ?? null;
  },

  async createFaculty(dto: CreateFacultyDto) {
    await delay(300);

    const now = new Date().toISOString();

    const faculty: FacultyResponseDto = {
      id: dto.id || crypto.randomUUID(),
      email: dto.email,
      firstName: dto.firstName,
      middleInitial: dto.middleInitial,
      lastName: dto.lastName,
      suffix: dto.suffix,
      role: dto.role,
      institute: dto.institute,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    facultiesMap.set(faculty.id, faculty);

    return faculty;
  },

  async updateFaculty(
    facultyId: string,
    dto: UpdateFacultyDto
  ) {
    await delay(300);

    const existing = facultiesMap.get(facultyId);

    if (!existing) {
      return false;
    }

    facultiesMap.set(facultyId, {
      ...existing,
      ...dto,
      updatedAt: new Date().toISOString(),
    });

    return true;
  },

  async deleteFaculty(facultyId: string) {
    await delay(200);
    return facultiesMap.delete(facultyId);
  },
};