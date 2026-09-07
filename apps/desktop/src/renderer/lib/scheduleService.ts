import { createScheduleService } from "@monteai/api";
import { apiClient } from "./apiClient";

const client = apiClient;

export const scheduleService = createScheduleService(
  client,
  import.meta.env.VITE_USE_MOCK === "true"
);

