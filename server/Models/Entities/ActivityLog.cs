using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace server.Models.Entities
{
    /// <summary>
    /// One row per analytics event — powers the admin Dashboard's
    /// "Query &amp; Activity Monitoring" and the chat suggestion chips.
    ///
    /// Types (ActivityLogTypes):
    ///   chat_query    — a user chat message was persisted (query text)
    ///   catalog_search— GET /thesis/search (query text)
    ///   thesis_view   — GET /thesis/{id} (ThesisId)
    ///   thesis_download — LEGACY: no longer recorded (users/students may not
    ///                   download theses; old rows linger only)
    ///   llm_usage     — daily-quota meter tick: one row per LLM-answered chat
    ///                   query (UserId + OccurredAt only, no query text —
    ///                   deliberately NOT removed when chat sessions are deleted,
    ///                   so the quota is never refunded)
    ///
    /// NormalizedQuery is the grouping key (lowercase, trimmed, collapsed
    /// whitespace); Query keeps the original display text so suggestions and
    /// the dashboard show what users actually typed.
    /// </summary>
    public class ActivityLog
    {
        /// <summary>SQL Server identity — rows are insert-only analytics.</summary>
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public long Id { get; set; }

        [Required]
        [MaxLength(30)]
        public string Type { get; set; } = string.Empty;

        /// <summary>Original query text as the user typed it (null for view/download events).</summary>
        [MaxLength(500)]
        public string? Query { get; set; }

        /// <summary>Grouping key for Query — lowercased/trimmed/collapsed (null when Query is null).</summary>
        [MaxLength(500)]
        public string? NormalizedQuery { get; set; }

        public Guid? ThesisId { get; set; }

        /// <summary>Firebase UID of the actor (null when unauthenticated/anonymous).</summary>
        [MaxLength(128)]
        public string? UserId { get; set; }

        /// <summary>Stamped in code (DateTime.UtcNow) — no DB default so the SQLite test schema matches.</summary>
        public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>Well-known Type values shared by recorders and queries.</summary>
    public static class ActivityLogTypes
    {
        public const string ChatQuery = "chat_query";
        public const string CatalogSearch = "catalog_search";
        public const string ThesisView = "thesis_view";
        public const string ThesisDownload = "thesis_download";

        /// <summary>One LLM-answered chat query — the daily-quota meter (content-free, never deleted with sessions).</summary>
        public const string LlmUsage = "llm_usage";
    }
}
