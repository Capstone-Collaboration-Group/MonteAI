// packages/api/src/analytics/mockAnalyticsService.ts
//
// Mock data behind VITE_USE_MOCK — sample CDM topics/theses so the
// Dashboard monitoring section and chat suggestions render in mock mode.
import type { AnalyticsOverviewDto } from "@monteai/types";
import type { AnalyticsService } from "./types";

const overview: AnalyticsOverviewDto = {
  rangeDays: 30,
  totals: { queries: 128, searches: 74, views: 312 },
  topQueries: [
    { query: "studies about gamification in education", count: 23 },
    { query: "IoT-based smart irrigation", count: 17 },
    { query: "student benefits on cloud platforms", count: 14 },
    { query: "research methodologies for capstone projects", count: 11 },
    { query: "secondary science pedagogy literacy interventions", count: 9 },
  ],
  topTheses: [
    {
      thesisId: "0b6f8a5e-9c1d-4f2a-8e3b-1a2b3c4d5e6f",
      title: "Adaptive Gamification in Primary School Literacy",
      count: 48,
    },
    {
      thesisId: "1c7e9b6f-8d2e-4a3b-9f4c-2b3c4d5e6f7a",
      title: "Automated Campus Energy Monitoring and IoT Power Optimization",
      count: 36,
    },
    {
      thesisId: "2d8f0c7a-9e3f-4b4c-8a5d-3c4d5e6f7a8b",
      title: "Early Childhood Literacy Interventions Using Storytelling",
      count: 27,
    },
    {
      thesisId: "3e9a1d8b-0f4a-4c5d-9b6e-4d5e6f7a8b9c",
      title: "Digital Marketing and Financial Sustainability of Montalban Startups",
      count: 21,
    },
    {
      thesisId: "4f0b2e9c-1a5b-4d6e-8c7f-5e6f7a8b9c0d",
      title: "Inquiry-Based Learning Modalities in Secondary Science",
      count: 18,
    },
  ],
};

export const mockAnalyticsService: AnalyticsService = {
  async getOverview(): Promise<AnalyticsOverviewDto> {
    return overview;
  },

  async getSuggestions(limit = 6): Promise<string[]> {
    return overview.topQueries.slice(0, limit).map((q) => q.query);
  },
};
