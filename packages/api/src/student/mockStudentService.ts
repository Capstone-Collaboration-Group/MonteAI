// packages/api/src/student/mockStudentService.ts

import type { StudentService } from "./types";
import type {
  StudentResponseDto,
  CreateStudentDto,
  UpdateStudentDto,
} from "@monteai/types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log("mockStudentService loaded — Initialized with seed data");

function buildSeed(): StudentResponseDto[] {
  return [
    {
      id: "student-1",
      email: "john.doe@student.monteai.edu",
      firstName: "John",
      middleInitial: "A",
      lastName: "Doe",
      suffix: "",
      studentNumber: "2023-00001",
      researchGroup: {
        id: "research-group-1",
        groupName: "Group Alpha",
        researchTitle: "AI-Driven Student Performance Prediction",
        adviserId: "faculty-1",
        leaderId: "student-1",
        createdAt: "2025-01-10T08:00:00.000Z",
        updatedAt: "2025-01-10T08:00:00.000Z",
        institute: 'Institute of Computing Studies'
      },
      position: "Leader",
      institute: "Institute of Computing Studies",
      program: "BS Information Technology",
      yearLevel: 4,
      section: "4A",
      role: "Student",
      isActive: true,
      createdAt: "2025-01-10T08:00:00.000Z",
      updatedAt: "2025-01-10T08:00:00.000Z",
    },
    {
      id: "student-2",
      email: "jane.smith@student.monteai.edu",
      firstName: "Jane",
      middleInitial: "B",
      lastName: "Smith",
      suffix: "",
      studentNumber: "2023-00002",
      researchGroup: {
        id: "research-group-2",
        groupName: "Group Beta",
        researchTitle: "Smart Attendance Monitoring System",
        adviserId: "faculty-2",
        leaderId: "student-2",
        createdAt: "2025-01-15T09:30:00.000Z",
        updatedAt: "2025-01-15T09:30:00.000Z",
        institute: "Institute of Business and Entrepreneurship"
      },
      position: "Member",
      institute: "Institute of Computing Studies",
      program: "BS Information Technology",
      yearLevel: 4,
      section: "4A",
      role: "Student",
      isActive: true,
      createdAt: "2025-01-15T09:30:00.000Z",
      updatedAt: "2025-01-15T09:30:00.000Z",
    },
    {
      id: "student-3",
      email: "michael.tan@student.monteai.edu",
      firstName: "Michael",
      middleInitial: "C",
      lastName: "Tan",
      suffix: "",
      studentNumber: "2023-00003",
      position: "Leader",
      institute: "Institute of Computing Studies",
      program: "BS Computer Science",
      yearLevel: 3,
      section: "3B",
      role: "Student",
      isActive: true,
      createdAt: "2025-01-20T10:15:00.000Z",
      updatedAt: "2025-01-20T10:15:00.000Z",
    },
  ];
}

const studentsMap = new Map<string, StudentResponseDto>();

buildSeed().forEach((student) => studentsMap.set(student.id, student));

export const mockStudentService: StudentService = {
  async getStudents() {
    await delay(300);
    return Array.from(studentsMap.values());
  },

  async getStudent(studentId: string) {
    await delay(150);
    return studentsMap.get(studentId) ?? null;
  },

  async createStudent(dto: CreateStudentDto) {
    await delay(300);

    const now = new Date().toISOString();

    const student: StudentResponseDto = {
      id: dto.id || crypto.randomUUID(),
      email: dto.email,
      firstName: dto.firstName,
      middleInitial: dto.middleInitial,
      lastName: dto.lastName,
      suffix: dto.suffix,
      studentNumber: dto.studentNumber,
      position: dto.position,
      institute: dto.institute,
      program: dto.program,
      yearLevel: dto.yearLevel,
      section: dto.section,
      role: "Student",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    studentsMap.set(student.id, student);

    return true;
  },

  async updateStudent(
    studentId: string,
    dto: UpdateStudentDto
  ) {
    await delay(300);

    const existing = studentsMap.get(studentId);

    if (!existing) {
      return false;
    }

    studentsMap.set(studentId, {
      ...existing,
      ...dto,
      updatedAt: new Date().toISOString(),
    });

    return true;
  },

  async deleteStudent(studentId: string) {
    await delay(200);
    return studentsMap.delete(studentId);
  },
};