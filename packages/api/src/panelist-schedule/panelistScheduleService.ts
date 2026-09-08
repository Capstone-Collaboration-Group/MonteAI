import { type AxiosInstance } from "axios";
import type {
    CreatePanelistScheduleDto,
    UpdatePanelistScheduleDto,
    PanelistScheduleResponseDto,
    PanelistResponseDto,
} from "@monteai/types";
import { handle404 } from "@monteai/utils";
import type { PanelistScheduleService } from "./types";

export class LivePanelistScheduleService implements PanelistScheduleService {
    private readonly client: AxiosInstance;
    constructor(client: AxiosInstance) {
        this.client = client;
    }

    // GET /panelistschedule — enriched person data with assignments
    async getPanelistSchedules(): Promise<PanelistResponseDto[]> {
        try {
            const { data } = await this.client.get<PanelistResponseDto[]>(`/panelistschedule`);
            return data;
        } catch (err) {
            return handle404(err, []);
        }
    }

    // GET /panelistschedule/by-panelist/{panelistId}
    async getPanelistSchedulesById(panelistId: string): Promise<PanelistScheduleResponseDto[]> {
        try {
            const { data } = await this.client.get<PanelistScheduleResponseDto[]>(
                `/panelistschedule/by-panelist/${panelistId}`
            );
            return data;
        } catch (err) {
            return handle404(err, []);
        }
    }

    // GET /panelistschedule/{scheduleId}?panelistId=xxx
    async getPanelistScheduleById(scheduleId: string, panelistId: string): Promise<PanelistScheduleResponseDto | null> {
        try {
            const { data } = await this.client.get<PanelistScheduleResponseDto>(
                `/panelistschedule/${scheduleId}`,
                { params: { panelistId } }
            );
            return data;
        } catch (err) {
            return handle404(err, null);
        }
    }

    // POST /panelistschedule/create
    async createPanelistSchedule(dto: CreatePanelistScheduleDto): Promise<boolean> {
        try {
            const { data } = await this.client.post<boolean>(`/panelistschedule/create`, dto);
            return data;
        } catch (err) {
            return handle404(err, false);
        }
    }

    // PATCH /panelistschedule/update/{scheduleId}?panelistId=xxx
    async updatePanelistSchedule(scheduleId: string, panelistId: string, dto: UpdatePanelistScheduleDto): Promise<boolean> {
        try {
            const { data } = await this.client.patch<boolean>(
                `/panelistschedule/update/${scheduleId}`,
                dto,
                { params: { panelistId } }
            );
            return data;
        } catch (err) {
            return handle404(err, false);
        }
    }

    // DELETE /panelistschedule/delete/{scheduleId}/{panelistId}
    async deletePanelistSchedule(scheduleId: string, panelistId: string): Promise<boolean> {
        try {
            const { data } = await this.client.delete<boolean>(
                `/panelistschedule/delete/${scheduleId}/${panelistId}`
            );
            return data;
        } catch (err) {
            return handle404(err, false);
        }
    }
}