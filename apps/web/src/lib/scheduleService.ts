import { createScheduleService } from "@monteai/api";
import { apiClient } from "./firebaseServices";

export const scheduleService = createScheduleService(
  apiClient,
  import.meta.env.VITE_USE_MOCK === "true"
);

