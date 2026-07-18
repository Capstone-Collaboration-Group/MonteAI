export interface CreateFacultyDto {
  id: string;
  email: string;
  firstName: string;
  middleInitial?: string;
  lastName: string;
  suffix?: string;
  role: string;
  institute: string;
}

export interface UpdateFacultyDto {
  email?: string;
  firstName?: string;
  middleInitial?: string;
  lastName?: string;
  suffix?: string;
  role?: string;
  institute?: string;
  isActive?: boolean;
}

export interface FacultyResponseDto {
  id: string;
  email: string;
  firstName: string;
  middleInitial?: string;
  lastName: string;
  suffix?: string;
  role: string;
  isActive?: boolean;
  institute: string;
  createdAt: string;
  updatedAt: string;
}

export type FacultyResponseListDto = FacultyResponseDto[];