namespace server.Repositories.Interfaces
{
    /// <summary>Top-query rollup row (already aggregated by NormalizedQuery).</summary>
    public sealed record TopQueryRow(string? NormalizedQuery, string? DisplayQuery, int Count);

    /// <summary>Top-thesis access rollup row.</summary>
    public sealed record TopThesisRow(Guid ThesisId, int Count);

    /// <summary>Event counts by kind inside a time window.</summary>
    public sealed record ActivityTotalsRow(int ChatQueries, int CatalogSearches, int ThesisViews);

    // server/Repositories/Interfaces/IActivityLogRepository.cs
    //
    // Insert-only analytics store (ActivityLogs table). Recording is called
    // from Chat/Thesis controllers on the request path, so RecordAsync must
    // stay a single fast INSERT; aggregations run in SQL for the dashboard.
    public interface IActivityLogRepository
    {
        /// <summary>Persists one event. Query is normalized here; pass the raw user text.</summary>
        Task RecordAsync(
            string type,
            string? query = null,
            Guid? thesisId = null,
            string? userId = null,
            CancellationToken ct = default);

        /// <summary>
        /// Most frequent chat/catalog queries since <paramref name="since"/>, grouped by
        /// NormalizedQuery. DisplayQuery is the most recent original text for that group.
        /// </summary>
        Task<List<TopQueryRow>> GetTopQueriesAsync(DateTime since, int take, CancellationToken ct = default);

        /// <summary>Most-accessed theses since <paramref name="since"/> (view + download events).</summary>
        Task<List<TopThesisRow>> GetTopThesesAsync(DateTime since, int take, CancellationToken ct = default);

        /// <summary>Per-kind event counts since <paramref name="since"/>.</summary>
        Task<ActivityTotalsRow> GetTotalsAsync(DateTime since, CancellationToken ct = default);

        /// <summary>Number of llm_usage ticks recorded for <paramref name="userId"/> since <paramref name="since"/> — the daily-quota count.</summary>
        Task<int> CountLlmUsageAsync(string userId, DateTime since, CancellationToken ct = default);

        /// <summary>
        /// Removes every chat_query row belonging to <paramref name="userId"/> (chat-session
        /// deletion clears the user's query trace). llm_usage ticks are deliberately
        /// NOT touched — the quota is monotonic and never refunded. Returns rows removed.
        /// </summary>
        Task<int> DeleteUserChatQueriesAsync(string userId, CancellationToken ct = default);
    }
}
