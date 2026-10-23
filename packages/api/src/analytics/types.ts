// packages/api/src/analytics/types.ts
import type { AnalyticsOverviewDto } from "@monteai/types";

/**
 * Query & Activity Monitoring API (GET /api/v1/analytics/*).
 * Overview requires the Admin role; suggestions is any signed-in user.
 */
export interface AnalyticsService {
  /** Dashboard rollups: totals + top queries + top accessed theses. */
  getOverview(days?: number): Promise<AnalyticsOverviewDto>;
  /** Most frequent query strings — feeds the chat suggestion cards. */
  getSuggestions(limit?: number): Promise<string[]>;
}
