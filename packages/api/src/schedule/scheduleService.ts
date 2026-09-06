import { type AxiosInstance } from "axios";
import type { 
    CreateScheduleDto, 
    UpdateScheduleDto,
    UpdateScheduleTimesDto,
    ScheduleResponseDto
} from "@monteai/types";
import type { ScheduleService } from "./types";
import { handle404 } from "@monteai/utils";

export class LiveScheduleService implements ScheduleService { 
    private readonly client: AxiosInstance;
    constructor (client: AxiosInstance) {
        this.client = client;
    }

    async getSchedules(): Promise<ScheduleResponseDto[] | []> {
        try { 
            const { data } = await this.client.get<ScheduleResponseDto[] | []>(`/schedule`);
            return data;
        } catch (err) { 
            return handle404(err, [])
        }
    }
    async getScheduleById(scheduleId: string): Promise<ScheduleResponseDto | null> {
        try { 
            const { data } = await this.client.get<ScheduleResponseDto | null>(`/schedule/${scheduleId}`);
            return data;
        } catch (err) { 
            return handle404(err, null);
        }
    }
    async createSchedule(dto: CreateScheduleDto): Promise<boolean> {
        const { data } = await this.client.post<boolean>(`/schedule/create`, dto);
        return data;
    }
    async updateSchedule(scheduleId: string, dto: UpdateScheduleDto): Promise<boolean> {
        try { 
            const { data } = await this.client.patch<boolean>(`/schedule/update/${scheduleId}`, dto);
            return data;
        } catch (err) { 
            return handle404(err, false);
        }
    }
    async updateScheduleTimes(scheduleId: string, dto: UpdateScheduleTimesDto): Promise<boolean> {
        try { 
            const { data } = await this.client.patch<boolean>(`/schedule/update-times/${scheduleId}`, dto);
            return data;
        } catch (err) { 
            return handle404(err, false);
        }
    }
    async deleteSchedule(scheduleId: string): Promise<boolean> {
        try { 
            const { data } = await this.client.delete<boolean>(`/schedule/delete/${scheduleId}`);
            return data;
        } catch (err) { 
            return handle404(err, false);
        }
    }
}