
export interface RegisterUserDto {
  id: string;
  email: string;
  firstName: string;
  middleInitial: string;
  lastName: string;
  suffix?: string;
  role: string;

  // Student-specific
  studentNumber?: string;
  groupId?: string;
  position?: string;
  institute?: string;
  program?: string;
  yearLevel?: number;
  section?: string;

  // Program Head-specific
  programHandled?: string;
}

export interface UpdateUserDto {
  email?: string;
  firstName?: string;
  middleInitial?: string;
  lastName?: string;
  suffix?: string;
  role?: string;
  isActive?: boolean;
}

export interface UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  middleInitial: string;
  lastName: string;
  suffix?: string;
  role: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}