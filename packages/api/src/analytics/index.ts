import type { AxiosInstance } from "axios";
import { mockAnalyticsService } from "./mockAnalyticsService";
import { LiveAnalyticsService } from "./analyticsService";
import type { AnalyticsService } from "./types";

export function createAnalyticsService(client: AxiosInstance, useMock: boolean): AnalyticsService {
  return useMock ? mockAnalyticsService : new LiveAnalyticsService(client);
}

export type { AnalyticsService } from "./types";
export { mockAnalyticsService } from "./mockAnalyticsService";
export { LiveAnalyticsService } from "./analyticsService";
