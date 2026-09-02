import type { AxiosInstance } from "axios";
import type { AuthUser } from "@monteai/types";

export type ProfileService = { 
    getCurrentProfile(): Promise<AuthUser>;
};

export function createProfileService(client:AxiosInstance): ProfileService { 
    return { 
        async getCurrentProfile() { 
            const { data } = await client.get<AuthUser>("Auth/me");
            return data;
        },
    };
}