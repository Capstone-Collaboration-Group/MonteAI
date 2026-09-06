import {createApiClient, createAnnouncementService} from "@monteai/api";

const client = createApiClient({
    baseURL: import.meta.env.VITE_API_BASE_URL
});

export const announcementService = createAnnouncementService(
    client,
    import.meta.env.VITE_USE_MOCK === "true"
);