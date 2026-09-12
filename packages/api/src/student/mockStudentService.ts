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
        institute: 'Institute of Computing Studies',
        members: [{ id: "student-1", studentNumber: "2023-00001", name: "John A. Doe", position: "Leader", program: "BS Information Technology" }],
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
        institute: "Institute of Business and Entrepreneurship",
        members: [{ id: "student-2", studentNumber: "2023-00002", name: "Jane B. Smith", position: "Leader", program: "BS Information Technology" }],
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
    {
      id: "student-4",
      email: "anna.reyes@student.monteai.edu",
      firstName: "Anna",
      middleInitial: "D",
      lastName: "Reyes",
      suffix: "",
      studentNumber: "2023-00004",
      position: "Member",
      institute: "Institute of Computing Studies",
      program: "BS Information Technology",
      yearLevel: 4,
      section: "4A",
      role: "Student",
      isActive: true,
      createdAt: "2025-01-22T08:00:00.000Z",
      updatedAt: "2025-01-22T08:00:00.000Z",
    },
  ];
}

const studentsMap = new Map<string, StudentResponseDto>();

buildSeed().forEach((student) => studentsMap.set(student.id, student));

export const mockStudentService: StudentService = {
  async getStudents(params) {
    await delay(300);

    let list = Array.from(studentsMap.values());

    const program = params?.program?.trim().toLowerCase();
    if (program) {
      list = list.filter((s) => s.program?.trim().toLowerCase() === program);
    }

    const search = params?.search?.trim().toLowerCase();
    if (search) {
      list = list.filter((s) => {
        const fullName = `${s.firstName} ${s.middleInitial ?? ''} ${s.lastName} ${s.suffix ?? ''}`
          .toLowerCase();
        return fullName.includes(search) || s.studentNumber.toLowerCase().includes(search);
      });
    }

    return list;
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