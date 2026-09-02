import { isAxiosError, type AxiosInstance } from "axios";
import {
    type AdminResponseDto,
    type UpdateAdminDto,
} from "@monteai/types";

import type { AdminService } from "./types";
export class LiveAdminService implements AdminService {
    private readonly client: AxiosInstance
    constructor(client: AxiosInstance) {
        this.client = client;
    }

    async getAdmins(): Promise<AdminResponseDto[] | []> {
        try {
            const { data } = await this.client.get<AdminResponseDto[]>(`/admin`);
            return data;
        } catch (err: unknown) {
            if (isAxiosError(err) && err.response?.status === 404) {
                return [];
            }
            throw err;
        }
    }

    async getAdmin(adminId: string): Promise<AdminResponseDto | null> {
        try {
            const { data } = await this.client.get<AdminResponseDto>(`/admin/${adminId}`);
            return data;
        } catch (err: unknown) {
            if (isAxiosError(err) && err.response?.status === 404) {
                return null;
            }
            throw err;
        }
    }

    async updateAdmin(adminId: string, dto: UpdateAdminDto): Promise<boolean> {
        try {
            const { data } = await this.client.patch<boolean>(`/admin/update/${adminId}`, dto);
            return data;
        } catch (err: unknown) {
            if (isAxiosError(err) && err.response?.status === 404) {
                return false;
            }
            throw err;
        }
    }

}
