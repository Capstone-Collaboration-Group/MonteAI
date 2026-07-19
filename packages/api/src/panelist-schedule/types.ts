import type  {
    CreatePanelistScheduleDto,
    UpdatePanelistScheduleDto,
    PanelistScheduleResponseDto
} from "@monteai/types"

export interface PanelistScheduleService { 
    getPanelistSchedules(): Promise<PanelistScheduleResponseDto[] | []>;
    getPanelistSchedulesById(panelistId: string): Promise<PanelistScheduleResponseDto[] | []>;
    getPanelistScheduleById(scheduleId: string, panelistId: string): Promise<PanelistScheduleResponseDto | null>;
    createPanelistSchedule(dto: CreatePanelistScheduleDto): Promise<boolean>;
    updatePanelistSchedule(scheduleId: string, panelistId: string, dto: UpdatePanelistScheduleDto): Promise<boolean>;
    deletePanelistSchedule(scheduleId: string): Promise<boolean>;
}