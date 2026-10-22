using Microsoft.Extensions.Options;
using server.Configuration;
using server.Models.DTOs.Analytics;
using server.Models.Entities;
using server.Repositories.Interfaces;
using server.Services.AI;
using server.Services.Interfaces;

namespace server.Services.Analytics
{
    // server/Services/Analytics/AnalyticsService.cs
    //
    // Thin orchestration over IActivityLogRepository + IThesisRepository:
    //   RecordAsync            — INSERT only, swallow+log failures (never breaks chat/search/view);
    //                            skips non-research queries (greetings, meta follow-ups,
    //                            gibberish, harmful content — see QueryModeration)
    //   GetOverviewAsync       — clamp window, roll up totals, join thesis titles
    //   GetSuggestionsAsync    — top query strings for the chat suggestion cards
    //   CheckDailyQuotaAsync   — rolling-window per-user chat cap counted from llm_usage
    //                            ticks (monotonic — session deletion never refunds it), fail-open
    //   RecordLlmUsageAsync    — +1 tick for a query that actually ran the LLM
    //   DeleteUserChatQueries  — clears a user's chat_query rows (session deletion); keeps ticks
    public class AnalyticsService : IAnalyticsService
    {
        /// <summary>Over-fetch factor on top-query reads so post-filtering still fills the page.</summary>
        private const int QueryOverFetch = 4;

        private readonly IActivityLogRepository _activityRepo;
        private readonly IThesisRepository _thesisRepo;
        private readonly AnalyticsConfig _config;
        private readonly ILogger<AnalyticsService> _logger;

        public AnalyticsService(
            IActivityLogRepository activityRepo,
            IThesisRepository thesisRepo,
            IOptions<AnalyticsConfig> config,
            ILogger<AnalyticsService> logger)
        {
            _activityRepo = activityRepo;
            _thesisRepo = thesisRepo;
            _config = config.Value;
            _logger = logger;
        }

        public async Task RecordAsync(
            string type,
            string? query = null,
            Guid? thesisId = null,
            string? userId = null,
            CancellationToken ct = default)
        {
            // Greetings, meta follow-ups ("expand your previous answer…"),
            // gibberish and harmful content never belong in top queries.
            // View/download events carry no query and always record.
            // The daily quota does NOT count these rows — it reads llm_usage
            // ticks, so recording stays purely about analytics quality.
            var isQueryEvent = type is ActivityLogTypes.ChatQuery or ActivityLogTypes.CatalogSearch;
            if (isQueryEvent && !QueryModeration.IsRecordable(query))
            {
                return;
            }

            try
            {
                await _activityRepo.RecordAsync(type, query, thesisId, userId, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Analytics record failed for {Type}", type);
            }
        }

        public async Task<AnalyticsOverviewDto> GetOverviewAsync(int days, CancellationToken ct = default)
        {
            days = Math.Clamp(days, 1, 365);
            var since = DateTime.UtcNow.AddDays(-days);

            var totals = await _activityRepo.GetTotalsAsync(since, ct);
            var topQueries = await _activityRepo.GetTopQueriesAsync(since, 10 * QueryOverFetch, ct);
            var topThesisRows = await _activityRepo.GetTopThesesAsync(since, 10, ct);

            var titles = await ResolveTitlesAsync(topThesisRows.Select(t => t.ThesisId), ct);

            return new AnalyticsOverviewDto
            {
                RangeDays = days,
                Totals = new ActivityTotalsDto
                {
                    Queries = totals.ChatQueries,
                    Searches = totals.CatalogSearches,
                    Views = totals.ThesisViews,
                },
                // Rows recorded BEFORE the moderation filter existed can still
                // be in the table — drop them at read time too, then re-cap.
                TopQueries = topQueries
                    .Where(q => !string.IsNullOrWhiteSpace(q.DisplayQuery) && QueryModeration.IsRecordable(q.DisplayQuery))
                    .Select(q => new TopQueryDto { Query = q.DisplayQuery!, Count = q.Count })
                    .Take(10)
                    .ToList(),
                TopTheses = topThesisRows
                    .Select(t => new TopThesisDto
                    {
                        ThesisId = t.ThesisId,
                        Title = titles.GetValueOrDefault(t.ThesisId) ?? "Untitled thesis",
                        Count = t.Count,
                    })
                    .ToList(),
            };
        }

        public async Task<IReadOnlyList<string>> GetSuggestionsAsync(int limit, int days = 30, CancellationToken ct = default)
        {
            limit = Math.Clamp(limit, 1, 20);
            days = Math.Clamp(days, 1, 365);

            var rows = await _activityRepo.GetTopQueriesAsync(
                DateTime.UtcNow.AddDays(-days), limit * QueryOverFetch, ct);
            return rows
                .Select(r => r.DisplayQuery)
                .Where(q => !string.IsNullOrWhiteSpace(q) && QueryModeration.IsRecordable(q))
                .Select(q => q!)
                .Take(limit)
                .ToList();
        }

        public async Task<string?> CheckDailyQuotaAsync(string userId, CancellationToken ct = default)
        {
            // Limit 0 (or negative) disables the cap; an unattributable caller
            // can't be counted, so let them through.
            if (_config.DailyQueryLimit <= 0 || string.IsNullOrWhiteSpace(userId)) return null;

            var windowHours = Math.Max(1, _config.DailyQueryWindowHours);
            var since = DateTime.UtcNow.AddHours(-windowHours);

            int used;
            try
            {
                used = await _activityRepo.CountLlmUsageAsync(userId, since, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Fail open: an analytics outage must never lock users out of chat.
                _logger.LogWarning(ex, "Daily quota check failed for user {UserId}; allowing the query", userId);
                return null;
            }

            if (used < _config.DailyQueryLimit) return null;

            return $"You've reached your limit of {_config.DailyQueryLimit} chat questions for now. " +
                   "Your quota refreshes over time — please try again later.";
        }

        public async Task RecordLlmUsageAsync(string userId, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(userId)) return;

            try
            {
                // Content-free tick: UserId + OccurredAt only. Never deleted with
                // chat sessions, so the daily quota can only ever go up in-window.
                await _activityRepo.RecordAsync(ActivityLogTypes.LlmUsage, userId: userId, ct: ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "LLM usage tick failed for user {UserId}", userId);
            }
        }

        public async Task DeleteUserChatQueriesAsync(string userId, CancellationToken ct = default)
        {
            try
            {
                var removed = await _activityRepo.DeleteUserChatQueriesAsync(userId, ct);
                if (removed > 0)
                {
                    _logger.LogInformation("Cleared {Count} chat query activity rows for user {UserId}", removed, userId);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Session already deleted — cleanup is best-effort, never surface it.
                _logger.LogWarning(ex, "Failed to clear chat query activity for user {UserId}", userId);
            }
        }

        /// <summary>Title lookup for the top-N ids (single query, no side-data loads beyond the includes).</summary>
        private async Task<Dictionary<Guid, string?>> ResolveTitlesAsync(IEnumerable<Guid> ids, CancellationToken ct)
        {
            var idList = ids.ToList();
            if (idList.Count == 0) return [];

            var theses = await _thesisRepo.GetThesesByIdsAsync(idList, studentId: null, ct);
            return theses.ToDictionary(t => t.Id, t => t.Title);
        }
    }
}
