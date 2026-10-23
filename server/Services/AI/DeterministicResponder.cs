// server/Services/AI/DeterministicResponder.cs
//
// Zero-LLM fast path for the most common, most templatable student queries:
//   - "find/list studies about X"        -> retrieval + numbered title list
//   - "who authored/wrote X"             -> retrieval + author/title/year line
//   - "what year was X published"        -> retrieval + year line
//
// These are answered with ONE retrieval call and string templates — no
// planner, no synthesizer, no gate slot, no circuit breaker. On the free-tier
// Azure OpenAI deployment (~1-2 concurrent LLM calls) this absorbs a large
// slice of research-month traffic, which is dominated by exactly these
// lookup shapes.
//
// Classification is deliberately conservative: anything that does not match
// a strict pattern — or matches but retrieves nothing usable — returns null
// and the full agent pipeline handles the question as before. A misfire only
// costs one extra retrieval.
//
// Auto-registered by Scrutor (namespace server.Services.AI, matching
// interface, scoped lifetime like the toolbox it shares dependencies with).

using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using server.Configuration;
using server.Models.DTOs.ChatMessage;
using server.Models.Retrieval;
using server.Services.Interfaces;

namespace server.Services.AI
{
    /// <summary>A template-rendered answer produced without any LLM call.</summary>
    public sealed record DeterministicAnswer(string Answer, IReadOnlyList<ChatSourceDto> Sources);

    public interface IDeterministicResponder
    {
        /// <summary>
        /// Attempts to answer the query with retrieval + templates only.
        /// Returns null when the query is not a recognized lookup shape or
        /// retrieval found nothing usable — the caller should run the agent.
        /// </summary>
        Task<DeterministicAnswer?> TryAnswerAsync(string query, CancellationToken cancellationToken);
    }

    public sealed class DeterministicResponder : IDeterministicResponder
    {
        private readonly IPineconeService _pineconeService;
        private readonly IThesisMetadataResolver _metadataResolver;
        private readonly MonteAiAgentConfig _config;
        private readonly ILogger<DeterministicResponder> _logger;

        // "find/list/show/search for/look for (me) (some/any) studies/research/papers/theses about/on/regarding X"
        private static readonly Regex TopicListPattern = new(
            @"^(?:can\s+you\s+)?(?:find|list|show|search\s+for|look\s+for|looking\s+for)\s+(?:me\s+)?(?:some\s+|any\s+)?(?:studies|research|papers|theses|thesis|works)\s+(?:about|on|regarding|related\s+to|for)\s+(?<subject>.+?)[\s\?.!]*$",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        // "who authored/wrote X" / "who is the author of X"
        private static readonly Regex WhoAuthoredPattern = new(
            @"^who\s+(?:authored|wrote|is\s+(?:the\s+)?author\s+of)\s+(?<subject>.+?)[\s\?.!]*$",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        // "studies/research/papers by|authored by|written by X"
        private static readonly Regex StudiesByPattern = new(
            @"^(?:find|list|show|search\s+for|look\s+for)?\s*(?:studies|research|papers|theses|thesis)?\s*(?:by|authored\s+by|written\s+by)\s+(?<subject>.+?)[\s\?.!]*$",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        // "what year was X published/written/submitted" / "when was X published"
        private static readonly Regex YearPattern = new(
            @"^(?:what\s+year\s+(?:was|is)|when\s+(?:was|is))\s+(?<subject>.+?)(?:\s+(?:published|written|submitted|finished|completed))?[\s\?.!]*$",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        /// <summary>Publication years in theses predate e-paper workflows; anything before 1990 is treated as a misparse.</summary>
        private const int MinPlausibleYear = 1990;

        public DeterministicResponder(
            IPineconeService pineconeService,
            IThesisMetadataResolver metadataResolver,
            IOptions<MonteAiAgentConfig> config,
            ILogger<DeterministicResponder> logger)
        {
            _pineconeService = pineconeService;
            _metadataResolver = metadataResolver;
            _config = config.Value;
            _logger = logger;
        }

        public async Task<DeterministicAnswer?> TryAnswerAsync(string query, CancellationToken cancellationToken)
        {
            var trimmed = query.Trim();
            if (trimmed.Length == 0) return null;

            // Order matters: year questions can contain "studies about"-shaped
            // subjects, and author questions are the most specific lookup.
            if (YearPattern.Match(trimmed) is { Success: true } yearMatch)
            {
                return await AnswerYearAsync(yearMatch.Groups["subject"].Value.Trim(), cancellationToken);
            }

            if (WhoAuthoredPattern.Match(trimmed) is { Success: true } whoMatch)
            {
                return await AnswerAuthorAsync(whoMatch.Groups["subject"].Value.Trim(), viaStudiesBy: false, cancellationToken);
            }

            if (StudiesByPattern.Match(trimmed) is { Success: true } byMatch &&
                byMatch.Groups["subject"].Value.Trim().Length >= 3)
            {
                return await AnswerAuthorAsync(byMatch.Groups["subject"].Value.Trim(), viaStudiesBy: true, cancellationToken);
            }

            if (TopicListPattern.Match(trimmed) is { Success: true } topicMatch &&
                topicMatch.Groups["subject"].Value.Trim().Length >= 3)
            {
                return await AnswerTopicListAsync(topicMatch.Groups["subject"].Value.Trim(), cancellationToken);
            }

            return null;
        }

        // ────────────────────── per-pattern answers ──────────────────────

        private async Task<DeterministicAnswer?> AnswerTopicListAsync(string subject, CancellationToken ct)
        {
            var sources = await RetrieveDedupedAsync(subject, topK: 12, ct);
            if (sources.Count == 0) return null;

            var shown = sources.Take(5).ToList();
            var sb = new StringBuilder();
            sb.Append("I found the following studies in the repository about **").Append(subject).Append("**:\n\n");
            for (var i = 0; i < shown.Count; i++)
            {
                var s = shown[i];
                sb.Append((i + 1)).Append(". ").Append(s.Title ?? "Untitled").Append("");
                if (!string.IsNullOrWhiteSpace(s.Authors)) sb.Append(" — ").Append(s.Authors);
                if (!string.IsNullOrWhiteSpace(s.PublicationYear)) sb.Append(" (").Append(s.PublicationYear).Append(')');
                sb.Append(" [Source ").Append(i + 1).Append("]\n");
            }
            if (sources.Count > shown.Count)
            {
                sb.Append("\nAsk me about any of these for details, or rephrase to search for something else.");
            }

            return new DeterministicAnswer(sb.ToString(), shown);
        }

        private async Task<DeterministicAnswer?> AnswerAuthorAsync(string subject, bool viaStudiesBy, CancellationToken ct)
        {
            // For "studies by X" the subject IS the author; for "who authored X"
            // it may be a title OR a name — semantic search handles both (the
            // validated planner recipe puts author names inside the query too).
            var sources = await RetrieveDedupedAsync(subject, topK: 12, ct);
            if (sources.Count == 0) return null;

            var surname = ExtractSignificantNameTokens(subject);

            // Prefer sources whose author metadata actually mentions the name.
            var authorMatches = sources
                .Where(s => !string.IsNullOrWhiteSpace(s.Authors) &&
                            surname.All(token =>
                                s.Authors.Contains(token, StringComparison.OrdinalIgnoreCase)))
                .Take(5)
                .ToList();

            var shown = authorMatches.Count > 0 ? authorMatches : sources.Take(3).ToList();
            var confidence = authorMatches.Count > 0 ? null : " (closest matches by topic — the repository metadata may not list the author)";

            var sb = new StringBuilder();
            sb.Append(viaStudiesBy
                ? "Here are the studies"
                : "Here is what the repository holds");
            sb.Append(" related to **").Append(subject).Append("**").Append(confidence).Append(":\n\n");
            for (var i = 0; i < shown.Count; i++)
            {
                var s = shown[i];
                sb.Append((i + 1)).Append(". **").Append(s.Title ?? "Untitled").Append("**");
                sb.Append(" — ").Append(string.IsNullOrWhiteSpace(s.Authors) ? "Author(s) unknown" : s.Authors);
                if (!string.IsNullOrWhiteSpace(s.PublicationYear)) sb.Append(" (").Append(s.PublicationYear).Append(')');
                sb.Append(" [Source ").Append(i + 1).Append("]\n");
            }
            sb.Append("\nAsk about any of these for more detail.");

            return new DeterministicAnswer(sb.ToString(), shown);
        }

        private async Task<DeterministicAnswer?> AnswerYearAsync(string subject, CancellationToken ct)
        {
            var sources = await RetrieveDedupedAsync(subject, topK: 8, ct);

            var withYear = sources.FirstOrDefault(s =>
                int.TryParse(s.PublicationYear, out var year) && year >= MinPlausibleYear);
            if (withYear is null) return null;

            var sb = new StringBuilder();
            sb.Append("**").Append(withYear.Title ?? subject).Append("**")
              .Append(" was published in **").Append(withYear.PublicationYear).Append("**");
            if (!string.IsNullOrWhiteSpace(withYear.Authors))
            {
                sb.Append(" by ").Append(withYear.Authors);
            }
            sb.Append(". [Source 1]");

            return new DeterministicAnswer(sb.ToString(), [withYear]);
        }

        // ────────────────────── shared helpers ──────────────────────

        /// <summary>
        /// One semantic retrieval, keeping only the best-scoring chunk per
        /// thesis (these templates LIST studies — title/author/year — so a
        /// document must not appear as multiple numbered entries) after the
        /// global ScoreThreshold drops off-topic matches. Wider topK
        /// compensates for the per-thesis collapse.
        /// </summary>
        private async Task<List<ChatSourceDto>> RetrieveDedupedAsync(string query, int topK, CancellationToken ct)
        {
            var chunks = await _pineconeService.RetrieveRelevantChunksAsync(
                query, new RetrievalOptions { TopK = topK }, ct);

            var perThesis = new Dictionary<string, int>(StringComparer.Ordinal);
            var sources = new List<ChatSourceDto>();
            var maxPerThesis = Math.Max(1, _config.MaxPassagesPerThesis);

            foreach (var chunk in chunks)
            {
                var key = chunk.ThesisId ?? chunk.Title ?? chunk.Url ?? Guid.NewGuid().ToString();
                if (perThesis.GetValueOrDefault(key) >= maxPerThesis) continue;
                perThesis[key] = perThesis.GetValueOrDefault(key) + 1;

                sources.Add(new ChatSourceDto
                {
                    ThesisId = chunk.ThesisId,
                    Title = chunk.Title,
                    Authors = chunk.Authors,
                    PublicationYear = chunk.PublicationYear,
                    Snippet = chunk.Text.Length > 600 ? chunk.Text[..600] + "…" : chunk.Text,
                    Score = double.TryParse(chunk.RelevanceScore, out var score) ? score : null,
                    Url = chunk.Url,
                });
            }

            // Fill author/year from SQL/Firestore when the vector metadata
            // lacks them (vectors from before the ingest-time fix, or recovery
            // jobs with null metadata) — must happen BEFORE AnswerAuthorAsync
            // filters on author names and before "(year)" templates render.
            await _metadataResolver.EnrichAsync(sources, ct);

            _logger.LogInformation(
                "Deterministic fast path retrieved {Count} deduped thesis source(s) for query '{Query}'",
                sources.Count, query);
            return sources;
        }

        /// <summary>Lowercased tokens of a person-name query longer than 2 chars ("Juan Dela Cruz" -> [juan, dela, cruz]).</summary>
        private static List<string> ExtractSignificantNameTokens(string name)
        {
            return name
                .Split([' ', ',', '-'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(t => t.Length > 2 && !t.Equals("the", StringComparison.OrdinalIgnoreCase))
                .Select(t => t.ToLowerInvariant())
                .Distinct()
                .ToList();
        }
    }
}
