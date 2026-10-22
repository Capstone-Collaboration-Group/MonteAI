// packages/hooks/src/analytics/useAnalytics.ts
//
// Query & Activity Monitoring reads for the desktop Dashboard.
import { useQuery } from "@tanstack/react-query";
import type { AnalyticsService } from "@monteai/api";

export const analyticsKeys = {
  all: ["analytics"] as const,
  overview: (days: number) => ["analytics", "overview", days] as const,
  suggestions: (limit: number) => ["analytics", "suggestions", limit] as const,
};

/** Rolling-window overview: totals, top queries, top accessed theses. */
export function useAnalyticsOverview(analyticsService: AnalyticsService, days = 30) {
  return useQuery({
    queryKey: analyticsKeys.overview(days),
    queryFn: () => analyticsService.getOverview(days),
    staleTime: 60 * 1000,
  });
}

/** Top query strings — chat/home suggestion cards. */
export function useQuerySuggestions(analyticsService: AnalyticsService, limit = 6) {
  return useQuery({
    queryKey: analyticsKeys.suggestions(limit),
    queryFn: () => analyticsService.getSuggestions(limit),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
