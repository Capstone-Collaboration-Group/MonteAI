import { type AxiosInstance } from "axios";
import type { 
    CreatePanelistScheduleDto,
    UpdatePanelistScheduleDto,
    PanelistScheduleResponseDto
} from "@monteai/types";
import { handle404 } from "@monteai/utils";

import { PanelistScheduleService } from "./types";

export class LivePanelistScheduleService implements PanelistScheduleService { 
    constructor (private readonly client: AxiosInstance){}

    // getPanelistSchedules()
    async getPanelistSchedules(): Promise<PanelistScheduleResponseDto[] | []> { 
        try { 
            const { data } = await this.client.get<PanelistScheduleResponseDto[]>(`/panelistschedule`);
            return data;
        } catch (err) { 
            return handle404(err, []);
        }
    }
    // getPanelistSchedulesById(panelisId: string):
    async getPanelistSchedulesById(panelistId: string): Promise<PanelistScheduleResponseDto[] | []> {
        try { 
            const { data } = await this.client.get<PanelistScheduleResponseDto[]>(`/panelistschedule/${panelistId}`);
            return data;
        } catch(err){ 
            return handle404(err, []);
        }
    }
    // getPanelistScheduleById(scheduleId: string, panelistId: string)
    async getPanelistScheduleById(scheduleId: string, panelistId: string): Promise<PanelistScheduleResponseDto | null> {
        try { 
            const { data } = await this.client.get<PanelistScheduleResponseDto>(`/panelistschedule/${scheduleId}`, { params: { panelistId } });
            return data;
        } catch (err) { 
            return handle404(err, null);
        }
    }
    // createPanelistSchedule(dto: CreatePanelistScheduleDto)
    async createPanelistSchedule(dto: CreatePanelistScheduleDto): Promise<boolean> {
        try { 
            const { data } = await this.client.post<boolean>(`/panelistschedule/create`, dto);
            return data;
        } catch (err) { 
           return handle404(err, false);
        }
        
    }
    // updatePanelistSchedule(scheduleId: string, panelistId: string, dto: UpdatePanelistScheduleDto)
    async updatePanelistSchedule(scheduleId: string, panelistId: string, dto: UpdatePanelistScheduleDto): Promise<boolean> {
        try { 
            const { data } = await this.client.patch<boolean>(`/panelistschedule/update/${scheduleId}`, dto,  { params: { panelistId}});
            return data;
        } catch (err) { 
            return handle404(err, false);
        }
        
    }
    // deletePanelistSchedule()
    async deletePanelistSchedule(scheduleId: string): Promise<boolean> {
        try { 
            const { data } = await this.client.delete<boolean>(`/panelistschedule/delete/${scheduleId}`);
            return data;
        } catch (err) { 
            return handle404(err, false);
        }
        
    }
}
