import type { PanelistScheduleResponseDto } from "./panelist-schedule";
import type { ResearchGroupResponseDto } from "./research-group";

export interface CreatePanelistEntryDto {
  panelistId: string;
  panelistType: string;
}

export interface CreateScheduleDto {
  scheduledBy: string;
  groupId?: string;
  date: string;
  startTime: string;
  endingTime: string;
  roomVenue: string;
  additionalInformation?: string;
  panelists: CreatePanelistEntryDto[];
}

export interface UpdateScheduleDto {
  groupId?: string;
  date?: string;
  startTime?: string;
  endingTime?: string;
  roomVenue?: string;
  additionalInformation?: string;
  panelists?: PanelistScheduleResponseDto[];
}

export interface ScheduleResponseDto {
  scheduleId: string;
  scheduledBy: string;
  researchGroup?: ResearchGroupResponseDto;
  date: string;
  startTime: string;
  endingTime: string;
  roomVenue: string;
  additionalInformation?: string;
  panelists: PanelistScheduleResponseDto[];
}
