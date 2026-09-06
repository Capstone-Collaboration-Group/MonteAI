import type { AxiosInstance } from "axios";
import type { AuthUser } from "@monteai/types";
import { mockProfileService } from "./mockProfileService";

export type ProfileService = { 
    getCurrentProfile(): Promise<AuthUser>;
};

export function createProfileService(client: AxiosInstance, useMock = false): ProfileService { 
    if (useMock) return mockProfileService;
    return { 
        async getCurrentProfile() { 
            const { data } = await client.get<AuthUser>("Auth/me");
            return data;
        },
    };
}