export interface CreatePanelistScheduleDto {
  scheduleId: string;
  panelistId: string;
  panelistType: string;
}

export interface UpdatePanelistScheduleDto {
  panelistType: string;
}

export interface PanelistScheduleResponseDto {
  scheduleId: string;
  panelistId: string;
  panelistType: string;
}

export type PanelistScheduleResponseListDto = PanelistScheduleResponseDto[];