using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.Entities;
using server.Repositories.Interfaces;

namespace server.Repositories
{
    // server/Repositories/ActivityLogRepository.cs
    //
    // Aggregations run in SQL (GROUP BY) — the dashboard window is at most
    // a year of rows. Display text for a normalized group is resolved in a
    // second, index-assisted query (most recent original casing wins).
    public class ActivityLogRepository : IActivityLogRepository
    {
        private static readonly string[] QueryTypes = { ActivityLogTypes.ChatQuery, ActivityLogTypes.CatalogSearch };
        private static readonly string[] AccessTypes = { ActivityLogTypes.ThesisView, ActivityLogTypes.ThesisDownload };

        private readonly AppDbContext _db;

        public ActivityLogRepository(AppDbContext db)
        {
            _db = db;
        }

        public async Task RecordAsync(
            string type,
            string? query = null,
            Guid? thesisId = null,
            string? userId = null,
            CancellationToken ct = default)
        {
            var trimmed = string.IsNullOrWhiteSpace(query) ? null : query.Trim();
            if (trimmed != null && trimmed.Length > 500) trimmed = trimmed[..500];

            _db.ActivityLogs.Add(new ActivityLog
            {
                Type = type,
                Query = trimmed,
                NormalizedQuery = trimmed == null ? null : Normalize(trimmed),
                ThesisId = thesisId,
                UserId = userId,
                OccurredAt = DateTime.UtcNow,
            });
            await _db.SaveChangesAsync(ct);
        }

        /// <summary>Lowercase, collapse internal whitespace — the GROUP BY key.</summary>
        private static string Normalize(string text)
        {
            var normalized = string.Join(' ', text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToLowerInvariant();
            return normalized.Length > 500 ? normalized[..500] : normalized;
        }

        public async Task<List<TopQueryRow>> GetTopQueriesAsync(DateTime since, DateTime until, int skip, int take, CancellationToken ct = default)
        {
            if (take <= 0) return [];

            // Freeze the upper bound across pages so newly recorded queries
            // cannot move groups between pages while analytics filters them.
            var queries = _db.ActivityLogs.AsNoTracking()
                .Where(a => a.OccurredAt >= since && a.OccurredAt <= until &&
                            a.NormalizedQuery != null && a.Query != null && QueryTypes.Contains(a.Type));

            var groups = await queries
                .GroupBy(a => a.NormalizedQuery)
                .Select(g => new { Normalized = g.Key!, Count = g.Count() })
                .OrderByDescending(x => x.Count)
                .ThenBy(x => x.Normalized)
                .Skip(Math.Max(0, skip))
                .Take(take)
                .ToListAsync(ct);

            if (groups.Count == 0) return [];

            var norms = groups.Select(g => g.Normalized).ToList();
            var display = await queries
                .Where(a => norms.Contains(a.NormalizedQuery!))
                .GroupBy(a => a.NormalizedQuery)
                .Select(g => new
                {
                    Normalized = g.Key!,
                    Query = g.OrderByDescending(a => a.OccurredAt)
                        .ThenByDescending(a => a.Id)
                        .Select(a => a.Query)
                        .FirstOrDefault(),
                })
                .ToListAsync(ct);
            var displayByNorm = display.ToDictionary(x => x.Normalized, x => x.Query);

            return groups
                .Select(g => new TopQueryRow(g.Normalized, displayByNorm.GetValueOrDefault(g.Normalized), g.Count))
                .ToList();
        }

        public async Task<List<TopThesisRow>> GetTopThesesAsync(DateTime since, int take, CancellationToken ct = default)
        {
            if (take <= 0) return [];

            return await _db.ActivityLogs
                .Where(a => a.OccurredAt >= since && a.ThesisId != null && AccessTypes.Contains(a.Type))
                .GroupBy(a => a.ThesisId!.Value)
                .OrderByDescending(g => g.Count())
                .Take(take)
                .Select(g => new TopThesisRow(g.Key, g.Count()))
                .ToListAsync(ct);
        }

        public async Task<ActivityTotalsRow> GetTotalsAsync(DateTime since, CancellationToken ct = default)
        {
            var counts = await _db.ActivityLogs
                .Where(a => a.OccurredAt >= since)
                .GroupBy(a => a.Type)
                .Select(g => new { Type = g.Key, Count = g.Count() })
                .ToListAsync(ct);

            int CountOf(string type) => counts.FirstOrDefault(x => x.Type == type)?.Count ?? 0;

            // Download statistics are intentionally absent: students/users may
            // not download theses, so the dashboard never displays downloads.
            return new ActivityTotalsRow(
                CountOf(ActivityLogTypes.ChatQuery),
                CountOf(ActivityLogTypes.CatalogSearch),
                CountOf(ActivityLogTypes.ThesisView));
        }

        public async Task<int> CountLlmUsageAsync(string userId, DateTime since, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(userId)) return 0;

            return await _db.ActivityLogs
                .CountAsync(a =>
                    a.Type == ActivityLogTypes.LlmUsage &&
                    a.UserId == userId &&
                    a.OccurredAt >= since, ct);
        }

        public async Task<int> DeleteUserChatQueriesAsync(string userId, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(userId)) return 0;

            return await _db.ActivityLogs
                .Where(a => a.Type == ActivityLogTypes.ChatQuery && a.UserId == userId)
                .ExecuteDeleteAsync(ct);
        }
    }
}
