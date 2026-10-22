// server/Models/DTOs/Analytics/AnalyticsDtos.cs
//
// Response contracts for the admin Dashboard's Query & Activity Monitoring
// and the chat suggestion endpoint. Both are shaped by IAnalyticsService
// from ActivityLogs rollups.

namespace server.Models.DTOs.Analytics
{
    /// <summary>One frequently searched topic (chat + catalog queries merged).</summary>
    public class TopQueryDto
    {
        /// <summary>Display text — the most recent original casing of this query.</summary>
        public string Query { get; set; } = string.Empty;

        public int Count { get; set; }
    }

    /// <summary>One frequently accessed thesis study.</summary>
    public class TopThesisDto
    {
        public Guid ThesisId { get; set; }

        public string Title { get; set; } = string.Empty;

        /// <summary>View events in the window (legacy download events may still count for old rows).</summary>
        public int Count { get; set; }
    }

    public class ActivityTotalsDto
    {
        /// <summary>User chat messages.</summary>
        public int Queries { get; set; }

        /// <summary>Catalog searches (GET /thesis/search).</summary>
        public int Searches { get; set; }

        public int Views { get; set; }
    }

    public class AnalyticsOverviewDto
    {
        /// <summary>Window length actually applied (days).</summary>
        public int RangeDays { get; set; }

        public ActivityTotalsDto Totals { get; set; } = new();

        public List<TopQueryDto> TopQueries { get; set; } = [];

        public List<TopThesisDto> TopTheses { get; set; } = [];
    }

    /// <summary>Payload for GET /analytics/suggestions.</summary>
    public class AnalyticsSuggestionsDto
    {
        public List<string> Suggestions { get; set; } = [];
    }
}
