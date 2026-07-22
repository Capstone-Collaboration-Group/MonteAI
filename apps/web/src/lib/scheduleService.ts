import { createScheduleService } from "@monteai/api";
import { apiClient } from "./firebaseServices"; // reuse your existing configured client

export const scheduleService = createScheduleService(
  apiClient,
  import.meta.env.VITE_USE_MOCK_SCHEDULE === "true"
);