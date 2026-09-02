import { type AxiosInstance } from "axios";
import {
    type FacultyResponseDto,
    type CreateFacultyDto,
    type UpdateFacultyDto,
} from "@monteai/types";
import { handle404 } from "@monteai/utils";

import type { FacultyService } from "./types";

export class LiveFacultyService implements FacultyService {
    private readonly client: AxiosInstance;
    constructor(client: AxiosInstance) {
        this.client = client;
    }

    async getFaculties(): Promise<FacultyResponseDto[] | []> {
        try {
            const { data } = await this.client.get<FacultyResponseDto[]>(`faculty`);
            return data;
        } catch (err) {
            return handle404(err, []);
        }
    }

    async getFaculty(facultyId: string): Promise<FacultyResponseDto | null> {
        try {
            const { data } = await this.client.get<FacultyResponseDto>(`faculty/${facultyId}`);
            return data;
        } catch (err) {
            return handle404(err, null);
        }
    }

    async createFaculty(dto: CreateFacultyDto): Promise<FacultyResponseDto> {
        const { data } = await this.client.post<FacultyResponseDto>(`faculty/create`,dto);
        return data;
    }

    async updateFaculty(facultyId: string,dto: UpdateFacultyDto): Promise<boolean> {
        try {
            const { data } = await this.client.patch<boolean>(`faculty/update/${facultyId}`,dto);
            return data;
        } catch (err) {
            return handle404(err, false);
        }
    }

    async deleteFaculty(facultyId: string): Promise<boolean> {
        try {
            const { data } = await this.client.delete<boolean>(`faculty/delete/${facultyId}`);
            return data;
        } catch (err) {
            return handle404(err, false);
        }
    }
}