import type { 
    CreateScheduleDto,
    UpdateScheduleDto,
    ScheduleResponseDto
} from "@monteai/types";

export interface ScheduleService { 
    getSchedules(): Promise<ScheduleResponseDto[] | []>;
    getScheduleById(scheduleId: string): Promise<ScheduleResponseDto | null>;
    createSchedule(dto: CreateScheduleDto): Promise<boolean>;
    updateSchedule(scheduleId: string, dto: UpdateScheduleDto): Promise<boolean>;
    deleteSchedule(scheduleId: string): Promise<boolean>;
}