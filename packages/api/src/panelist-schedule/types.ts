import type {
    CreatePanelistScheduleDto,
    UpdatePanelistScheduleDto,
    PanelistScheduleResponseDto,
    PanelistResponseDto,
} from "@monteai/types";

export interface PanelistScheduleService {
    // Returns enriched person data with assignment summaries
    getPanelistSchedules(): Promise<PanelistResponseDto[]>;

    // Raw assignment lookups
    getPanelistSchedulesById(panelistId: string): Promise<PanelistScheduleResponseDto[]>;
    getPanelistScheduleById(scheduleId: string, panelistId: string): Promise<PanelistScheduleResponseDto | null>;

    // CRUD
    createPanelistSchedule(dto: CreatePanelistScheduleDto): Promise<boolean>;
    updatePanelistSchedule(scheduleId: string, panelistId: string, dto: UpdatePanelistScheduleDto): Promise<boolean>;
    deletePanelistSchedule(scheduleId: string, panelistId: string): Promise<boolean>; // fixed: needs panelistId
}