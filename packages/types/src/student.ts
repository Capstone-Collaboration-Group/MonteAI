import type { ResearchGroupResponseDto } from "./research-group";

export interface CreateStudentDto {
  id: string;
  email: string;
  firstName: string;
  middleInitial?: string;
  lastName: string;
  suffix?: string;
  studentNumber: string;
  groupId?: string;
  position: string;
  institute: string;
  program: string;
  yearLevel: number;
  section: string;
}

export interface UpdateStudentDto {
  email?: string;
  firstName?: string;
  middleInitial?: string;
  lastName?: string;
  suffix?: string;
  studentNumber?: string;
  groupId?: string;
  position?: string;
  institute?: string;
  program?: string;
  yearLevel?: number;
  section?: string;
  isActive?: boolean;
}

export interface StudentResponseDto {
  id: string;
  email: string;
  firstName: string;
  middleInitial?: string;
  lastName: string;
  suffix?: string;
  studentNumber: string;
  researchGroup?: ResearchGroupResponseDto;
  position: string;
  institute: string;
  program: string;
  yearLevel: number;
  section: string;
  role: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StudentResponseListDto = StudentResponseDto[];