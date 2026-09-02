import { createApiClient, createScheduleService } from "@monteai/api";



 const apiClient = await createApiClient({ baseURL: import.meta.env.VITE_API_BASE_URL });

export const scheduleService = createScheduleService(
  apiClient,
  import.meta.env.VITE_USE_MOCK === "true"
);

