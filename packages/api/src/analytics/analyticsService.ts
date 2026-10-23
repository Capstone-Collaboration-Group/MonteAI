// packages/api/src/analytics/analyticsService.ts
//
// Live analytics service — plain REST reads. Suggestions calls fail soft at
// the call site (chat falls back to static prompts), so errors here just
// propagate to the caller's catch block.
import type { AxiosInstance } from "axios";
import type { AnalyticsOverviewDto, AnalyticsSuggestionsDto } from "@monteai/types";
import type { AnalyticsService } from "./types";

export class LiveAnalyticsService implements AnalyticsService {
  private readonly client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  async getOverview(days = 30): Promise<AnalyticsOverviewDto> {
    const { data } = await this.client.get<AnalyticsOverviewDto>("/analytics/overview", {
      params: { days },
    });
    return data;
  }

  async getSuggestions(limit = 6): Promise<string[]> {
    const { data } = await this.client.get<AnalyticsSuggestionsDto>("/analytics/suggestions", {
      params: { limit },
    });
    return data?.suggestions ?? [];
  }
}
