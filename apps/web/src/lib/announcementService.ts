import {createAnnouncementService} from "@monteai/api";
import { apiClient } from "./firebaseServices";

export const announcementService = createAnnouncementService(
    apiClient,
    import.meta.env.VITE_USE_MOCK === "true"
);