import type { 
    CreateScheduleDto,
    UpdateScheduleDto,
    UpdateScheduleTimesDto,
    ScheduleResponseDto
} from "@monteai/types";

export interface ScheduleService { 
    getSchedules(): Promise<ScheduleResponseDto[] | []>;
    getScheduleById(scheduleId: string): Promise<ScheduleResponseDto | null>;
    createSchedule(dto: CreateScheduleDto): Promise<boolean>;
    updateSchedule(scheduleId: string, dto: UpdateScheduleDto): Promise<boolean>;
    updateScheduleTimes(scheduleId: string, dto: UpdateScheduleTimesDto): Promise<boolean>;
    deleteSchedule(scheduleId: string): Promise<boolean>;
}