import { createPanelistScheduleService } from "@monteai/api";
import { apiClient } from "./apiClient";

const client = apiClient;

export const panelistScheduleService = createPanelistScheduleService(
    client, 
    import.meta.env.VITE_USE_MOCK === "true"
)
    
    
