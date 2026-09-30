import { type AxiosInstance } from "axios";
import type { UserProfileDto, UpdateProfileRequest } from "@monteai/types";
import { handle404 } from "@monteai/utils";

import type { UserService } from "./types";

export class LiveUserService implements UserService {
    private readonly client: AxiosInstance;
    constructor(client: AxiosInstance) {
        this.client = client;
    }

    async getMe(): Promise<UserProfileDto | null> {
        try {
            const { data } = await this.client.get<UserProfileDto>("/User/me");
            return data;
        } catch (err) {
            return handle404(err, null);
        }
    }

    async updateMe(dto: UpdateProfileRequest): Promise<UserProfileDto | null> {
        try {
            // Empty strings are dropped: the server maps onto char columns
            // (e.g. middleInitial) where "" is invalid, and null/absent means
            // "leave unchanged".
            const payload = Object.fromEntries(
                Object.entries(dto).filter(([, value]) => value !== "" && value !== undefined)
            ) as UpdateProfileRequest;
            const { data } = await this.client.put<UserProfileDto>("/User/me", payload);
            return data;
        } catch (err) {
            return handle404(err, null);
        }
    }

    async revokeSessions(): Promise<boolean> {
        try {
            await this.client.post("/User/revoke-sessions");
            return true;
        } catch {
            return false;
        }
    }
}
