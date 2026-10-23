import {createNotificationService} from "@monteai/api";
import { apiClient } from "./apiClient";

export const notificationService = createNotificationService(
    apiClient,
    import.meta.env.VITE_USE_MOCK === "true"
);
