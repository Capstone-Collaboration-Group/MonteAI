export interface CreateProgramHeadDto {
  id: string;
  email: string;
  firstName: string;
  middleInitial?: string;
  lastName: string;
  suffix?: string;
  institute: string;
  programHandled: string;
}

export interface UpdateProgramHeadDto {
  email?: string;
  firstName?: string;
  middleInitial?: string;
  lastName?: string;
  suffix?: string;
  institute?: string;
  programHandled?: string;
  isActive?: boolean;
}

export interface ProgramHeadResponseDto {
  id: string;
  email: string;
  firstName: string;
  middleInitial?: string;
  lastName: string;
  suffix?: string;
  role: string;
  isActive?: boolean;
  institute: string;
  programHandled: string;
  createdAt: string;
  updatedAt: string;
}

export type ProgramHeadResponseListDto = ProgramHeadResponseDto[];