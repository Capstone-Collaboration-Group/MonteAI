// packages/types/src/panelist-schedule.ts

export type PanelistType = "Faculty" | "ProgramHead" | "Admin";

export interface CreatePanelistScheduleDto {
  scheduleId: string;
  panelistId: string;
  panelistType: PanelistType;
  role?: string;
}

export interface UpdatePanelistScheduleDto {
  panelistType: PanelistType;
  role?: string;
}

export interface PanelistScheduleResponseDto {
  scheduleId: string;
  panelistId: string;
  panelistType: PanelistType;
  role?: string;
  createdAt: string;
}

export interface PanelistAssignmentSummary {
  scheduleId: string;
  groupName: string;
  date: string;
  startTime: string;
  endingTime: string;
}

export interface PanelistResponseDto {
  id: string;
  firstName: string;
  middleInitial?: string;
  lastName: string;
  suffix?: string;
  email: string;
  role: string;
  institute?: string;  
  position?: string;  
  panelistType: PanelistType;
  isActive?: boolean;
  assignments: PanelistAssignmentSummary[];
  isAssigned: boolean; 
}
export type PanelistScheduleResponseListDto = PanelistScheduleResponseDto[];