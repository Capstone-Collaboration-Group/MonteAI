import { createAnalyticsService } from "@monteai/api";
import { apiClient } from "./apiClient";

const client = apiClient;

export const analyticsService = createAnalyticsService(
  client,
  import.meta.env.VITE_USE_MOCK === "true"
);
