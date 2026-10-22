// packages/types/src/analytics.ts
//
// Query & Activity Monitoring contracts (GET /api/v1/analytics/*) —
// shared by the desktop Dashboard and every chat suggestion surface.

/** One frequently searched topic (chat + catalog queries merged). */
export interface TopQueryDto {
  /** Display text — the most recent original casing of this query. */
  query: string;
  count: number;
}

/** One frequently accessed thesis study. */
export interface TopThesisDto {
  thesisId: string;
  title: string;
  /** View events in the window (legacy download events may still count for old rows). */
  count: number;
}

export interface ActivityTotalsDto {
  /** User chat messages. */
  queries: number;
  /** Catalog searches (GET /thesis/search). */
  searches: number;
  views: number;
}

export interface AnalyticsOverviewDto {
  /** Window length actually applied (days). */
  rangeDays: number;
  totals: ActivityTotalsDto;
  topQueries: TopQueryDto[];
  topTheses: TopThesisDto[];
}

/** Payload for GET /analytics/suggestions. */
export interface AnalyticsSuggestionsDto {
  suggestions: string[];
}
