import {createAnnouncementService} from "@monteai/api";
import { apiClient } from "./apiClient";

const client = apiClient;

export const announcementService = createAnnouncementService(
    client,
    import.meta.env.VITE_USE_MOCK === "true"
);