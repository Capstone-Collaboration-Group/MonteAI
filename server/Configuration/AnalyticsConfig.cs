// server/Configuration/AnalyticsConfig.cs
//
// Per-user daily query allowance for chat. Enforced on both send endpoints
// (blocking + SSE) BEFORE the user message is persisted or the agent runs,
// by counting the caller's llm_usage ticks inside a rolling window (see
// AnalyticsService.CheckDailyQuotaAsync). Every query that actually runs the
// LLM adds exactly one tick; ticks are never deleted, so chat-session
// deletion never refunds the quota.
//
// Bound from the "Analytics" section of appsettings*.json.

namespace server.Configuration
{
    public class AnalyticsConfig
    {
        public const string SectionName = "Analytics";

        /// <summary>
        /// How many chat queries one user may send inside the rolling window.
        /// Default: 30. Set to 0 (or negative) to disable the cap entirely.
        /// </summary>
        public int DailyQueryLimit { get; set; } = 30;

        /// <summary>
        /// Rolling window length in hours — each query expires this long after
        /// it was sent, which refreshes the allowance without any clock or
        /// timezone coupling. Default: 24.
        /// </summary>
        public int DailyQueryWindowHours { get; set; } = 24;
    }
}
