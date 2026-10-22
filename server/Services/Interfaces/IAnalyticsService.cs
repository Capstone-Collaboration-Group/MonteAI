using server.Models.DTOs.Analytics;

namespace server.Services.Interfaces
{
    // server/Services/Interfaces/IAnalyticsService.cs
    //
    // Query & Activity Monitoring: records analytics events (safe to call on
    // the request path — RecordAsync never throws) and aggregates them for
    // the admin Dashboard and the chat suggestion endpoint.
    public interface IAnalyticsService
    {
        /// <summary>
        /// Persists one analytics event. Failures are logged, never surfaced —
        /// callers sit on chat/search/view request paths where analytics must
        /// not break the user's action.
        /// </summary>
        Task RecordAsync(
            string type,
            string? query = null,
            Guid? thesisId = null,
            string? userId = null,
            CancellationToken ct = default);

        /// <summary>Dashboard overview: totals + top queries + top accessed theses for the window.</summary>
        Task<AnalyticsOverviewDto> GetOverviewAsync(int days, CancellationToken ct = default);

        /// <summary>Most frequent query strings (chat + catalog) — feeds the chat suggestion cards.</summary>
        Task<IReadOnlyList<string>> GetSuggestionsAsync(int limit, int days = 30, CancellationToken ct = default);

        /// <summary>
        /// Per-user daily chat quota: null when the user may still send a query,
        /// or a friendly user-facing message when their rolling-window allowance
        /// (AnalyticsConfig.DailyQueryLimit over DailyQueryWindowHours) is spent.
        /// Counted from llm_usage ticks — every LLM-answered query adds exactly 1
        /// and ticks are never removed, so deleting sessions never refunds quota.
        /// Never throws — fails open so an analytics outage can't lock chat out.
        /// </summary>
        Task<string?> CheckDailyQuotaAsync(string userId, CancellationToken ct = default);

        /// <summary>
        /// Adds ONE usage tick for a query that actually ran the LLM (the agent
        /// reports it via AgentChatResult.UsedLlm). Failures are logged, never surfaced.
        /// </summary>
        Task RecordLlmUsageAsync(string userId, CancellationToken ct = default);

        /// <summary>
        /// Removes the user's chat_query activity rows — called after a chat
        /// session is deleted so the query trace goes with it. llm_usage ticks
        /// are left alone (quota is never refunded). Failures are logged, never surfaced.
        /// </summary>
        Task DeleteUserChatQueriesAsync(string userId, CancellationToken ct = default);
    }
}
