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
// ANSWER SELECTION (the part that decides WHEN to answer at all):
//   - an explicit "titled/called/named X" (or a subject that matches a
//     retrieved title exactly) resolves to THAT thesis alone, or to a
//     "couldn't find it" reply with EMPTY sources — a topic-neighbour is
//     never presented as the requested study;
//   - an author question with neither a title nor an author match returns
//     null instead of the old "closest matches by topic" substitute;
//   - every topic-list source must clear DeterministicMinScore AND directly
//     mention the requested topic in its title/abstract. A strong match on
//     context alone cannot authorize a list of unrelated neighbours. When
//     none qualifies, return null so the agent can search and assess evidence.
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

        // "the thesis/study/paper titled|called|named X" — an EXPLICIT title
        // reference. These must resolve to exactly that thesis or say "not
        // found"; a topic-neighbour is never an acceptable substitute.
        private static readonly Regex ExplicitTitlePattern = new(
            @"^(?:the\s+)?(?:(?:thesis|study|paper|research\s+paper|article|document|work)\s+)?(?:titled|called|named)\s+(?<title>.+)$",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        // Compound-question tails: "<title>, and what year was it published" —
        // the clause after the COMMA (never a bare "and", which titles and
        // topics contain legitimately) is a second question, not part of the
        // subject. A "?" already truncates in CleanSubject before this runs.
        private static readonly Regex CompoundTailPattern = new(
            @",\s*(?:and\s+|then\s+)?(?:what|when|how|why|who|which|is|was|are|were|did|does|do|can|could|please)\b.*$",
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

            if (TopicQuery.TryParse(trimmed) is { } topic)
            {
                return await AnswerTopicListAsync(topic, cancellationToken);
            }

            return null;
        }

        // ────────────────────── per-pattern answers ──────────────────────

        private async Task<DeterministicAnswer?> AnswerTopicListAsync(TopicQuery topic, CancellationToken ct)
        {
            var sources = await RetrieveDedupedAsync(topic.Subject, topK: 12, ct);
            if (sources.Count == 0) return null;

            // Scores rank similarity, not coverage of the full topic. Require
            // content evidence AND the score floor independently for each
            // thesis, instead of letting the strongest hit qualify every row.
            var supported = sources
                .Where(s => s.Score >= _config.DeterministicMinScore && topic.HasDirectEvidence(s))
                .OrderByDescending(s => s.Score)
                .ToList();
            if (supported.Count == 0)
            {
                _logger.LogInformation(
                    "Deterministic topic list skipped for '{Subject}': no source has direct topic evidence and score >= {Floor:0.###}",
                    topic.Subject, _config.DeterministicMinScore);
                return null;
            }

            var shown = supported.Take(Math.Max(1, _config.MaxSources)).ToList();
            var sb = new StringBuilder();
            sb.Append("I found the following studies in the repository about **").Append(topic.Subject).Append("**:\n\n");
            for (var i = 0; i < shown.Count; i++)
            {
                var s = shown[i];
                sb.Append((i + 1)).Append(". ").Append(s.Title ?? "Untitled").Append("");
                if (!string.IsNullOrWhiteSpace(s.Authors)) sb.Append(" — ").Append(s.Authors);
                if (!string.IsNullOrWhiteSpace(s.PublicationYear)) sb.Append(" (").Append(s.PublicationYear).Append(')');
                sb.Append(" [Source ").Append(i + 1).Append("]\n");
            }
            if (supported.Count > shown.Count)
            {
                sb.Append("\nAsk me about any of these for details, or rephrase to search for something else.");
            }

            return new DeterministicAnswer(sb.ToString(), shown);
        }

        private async Task<DeterministicAnswer?> AnswerAuthorAsync(string subject, bool viaStudiesBy, CancellationToken ct)
        {
            var cleaned = CleanSubject(subject);
            if (cleaned.Length < 3) return null;

            // Explicit title reference ("the thesis titled X"): resolve to THAT
            // thesis or report "not found" — never to a topic-neighbour, and
            // never gated behind the author-token filter below (a title match
            // bypasses it outright).
            var explicitTitle = TryExtractExplicitTitle(cleaned, out var requestedTitle);
            var lookup = explicitTitle ? requestedTitle! : cleaned;

            // For "studies by X" the subject IS the author; for "who authored X"
            // it may be a title OR a name — semantic search handles both (the
            // validated planner recipe puts author names inside the query too).
            var sources = await RetrieveDedupedAsync(lookup, topK: 12, ct);

            if (explicitTitle)
            {
                var exact = sources.FirstOrDefault(s => IsTitleMatch(requestedTitle!, s.Title));
                if (exact is null)
                {
                    _logger.LogInformation(
                        "Deterministic exact-title lookup found no match for '{Title}'",
                        requestedTitle);
                    return NotFoundAnswer(requestedTitle!);
                }
                return SingleThesisAnswer(exact);
            }

            if (sources.Count == 0) return null;

            // The subject may itself be a thesis title even without the
            // titled/called/named marker ("who authored <title>") — an exact
            // title match outranks author matching and pins the answer to ONE
            // study instead of a "closest matches by topic" list.
            var titleMatch = sources.FirstOrDefault(s => IsTitleMatch(cleaned, s.Title));
            if (titleMatch is not null) return SingleThesisAnswer(titleMatch);

            var surname = ExtractSignificantNameTokens(cleaned);

            // Prefer sources whose author metadata actually mentions the name.
            List<ChatSourceDto> authorMatches = [];
            if (surname.Count > 0)
            {
                authorMatches = sources
                    .Where(s => !string.IsNullOrWhiteSpace(s.Authors) &&
                                surname.All(token =>
                                    s.Authors.Contains(token, StringComparison.OrdinalIgnoreCase)))
                    .Take(5)
                    .ToList();
            }

            // Neither a title nor an author match: the old fallback served the
            // top-3 TOPIC matches as if they answered the question (the root
            // cause of "wrong thesis presented as the answer"). Hand the query
            // to the agent instead — one retrieval was already spent, so a
            // misfire costs only one more.
            if (authorMatches.Count == 0) return null;

            var sb = new StringBuilder();
            sb.Append(viaStudiesBy
                ? "Here are the studies"
                : "Here is what the repository holds");
            sb.Append(" by **").Append(cleaned).Append("**:\n\n");
            for (var i = 0; i < authorMatches.Count; i++)
            {
                var s = authorMatches[i];
                sb.Append((i + 1)).Append(". **").Append(s.Title ?? "Untitled").Append("**");
                sb.Append(" — ").Append(string.IsNullOrWhiteSpace(s.Authors) ? "Author(s) unknown" : s.Authors);
                if (!string.IsNullOrWhiteSpace(s.PublicationYear)) sb.Append(" (").Append(s.PublicationYear).Append(')');
                sb.Append(" [Source ").Append(i + 1).Append("]\n");
            }
            sb.Append("\nAsk about any of these for more detail.");

            return new DeterministicAnswer(sb.ToString(), authorMatches);
        }

        private async Task<DeterministicAnswer?> AnswerYearAsync(string subject, CancellationToken ct)
        {
            var cleaned = CleanSubject(subject);
            if (cleaned.Length < 3) return null;

            var explicitTitle = TryExtractExplicitTitle(cleaned, out var requestedTitle);
            var lookup = explicitTitle ? requestedTitle! : cleaned;

            var sources = await RetrieveDedupedAsync(lookup, topK: 8, ct);
            if (sources.Count == 0)
            {
                return explicitTitle ? NotFoundAnswer(requestedTitle!) : null;
            }

            // An explicit (or title-shaped) subject must answer from THAT
            // thesis — a neighbouring study's year is simply wrong.
            ChatSourceDto? withYear;
            if (explicitTitle)
            {
                var exact = sources.FirstOrDefault(s => IsTitleMatch(requestedTitle!, s.Title));
                if (exact is null) return NotFoundAnswer(requestedTitle!);
                withYear = HasPlausibleYear(exact) ? exact : null;
            }
            else
            {
                withYear = sources.FirstOrDefault(s => IsTitleMatch(cleaned, s.Title) && HasPlausibleYear(s))
                           ?? sources.FirstOrDefault(HasPlausibleYear);
            }

            if (withYear is null) return null;

            var sb = new StringBuilder();
            sb.Append("**").Append(withYear.Title ?? cleaned).Append("**")
              .Append(" was published in **").Append(withYear.PublicationYear).Append("**");
            if (!string.IsNullOrWhiteSpace(withYear.Authors))
            {
                sb.Append(" by ").Append(withYear.Authors);
            }
            sb.Append(". [Source 1]");

            return new DeterministicAnswer(sb.ToString(), [withYear]);
        }

        // ────────────────────── shared helpers ──────────────────────

        /// <summary>True when the source carries a parseable, plausible publication year.</summary>
        private static bool HasPlausibleYear(ChatSourceDto source) =>
            int.TryParse(source.PublicationYear, out var year) && year >= MinPlausibleYear;

        /// <summary>
        /// Strips compound-question tails from a captured subject: everything
        /// after the first "?" and any ", and what/when/how…"-style second
        /// question after a comma. "Who authored X, and what year was it
        /// published" must look up X — not the whole sentence.
        /// </summary>
        private static string CleanSubject(string subject)
        {
            var s = subject.Trim();

            var q = s.IndexOf('?');
            if (q >= 0) s = s[..q];

            s = CompoundTailPattern.Replace(s, string.Empty);

            return s.Trim().TrimEnd(',', '.', '!', '?', ':', ';').Trim();
        }

        /// <summary>True when the subject carries an explicit titled/called/named marker; <paramref name="title"/> is the text after it.</summary>
        private static bool TryExtractExplicitTitle(string subject, out string title)
        {
            var match = ExplicitTitlePattern.Match(subject);
            var candidate = match.Success ? CleanSubject(match.Groups["title"].Value) : string.Empty;
            if (candidate.Length >= 3)
            {
                title = candidate;
                return true;
            }
            title = string.Empty;
            return false;
        }

        /// <summary>
        /// Case/punctuation-insensitive title comparison: exact normalized
        /// equality, or one title containing the other ("Effects of Modular
        /// Learning" vs the full submitted title). Substring containment is a
        /// safe signal here because both sides are full thesis titles.
        /// </summary>
        private static bool IsTitleMatch(string requested, string? candidate)
        {
            if (string.IsNullOrWhiteSpace(candidate)) return false;

            var a = NormalizeTitle(requested);
            var b = NormalizeTitle(candidate);
            if (a.Length < 4 || b.Length < 4) return false;
            if (string.Equals(a, b, StringComparison.Ordinal)) return true;

            return (a.Length >= 8 && b.Contains(a, StringComparison.Ordinal)) ||
                   (b.Length >= 8 && a.Contains(b, StringComparison.Ordinal));
        }

        /// <summary>Lowercased, punctuation-free, whitespace-collapsed title key.</summary>
        private static string NormalizeTitle(string text) =>
            Regex.Replace(text.ToLowerInvariant(), @"[^\p{L}\p{N}]+", " ").Trim();

        /// <summary>Answer for an explicitly requested thesis that does not exist — EMPTY sources so the panel is cleared instead of showing neighbours.</summary>
        private static DeterministicAnswer NotFoundAnswer(string requested) => new(
            $"I couldn't find a thesis titled \"{requested}\" in the repository. " +
            "It may not have been submitted yet, or the title may be slightly different — " +
            "check the spelling, or ask me to search for studies about a related topic instead.",
            []);

        /// <summary>One-thesis answer: title, authors, year, single citation.</summary>
        private static DeterministicAnswer SingleThesisAnswer(ChatSourceDto source)
        {
            var sb = new StringBuilder();
            sb.Append("**").Append(source.Title ?? "Untitled").Append("**");
            if (!string.IsNullOrWhiteSpace(source.Authors)) sb.Append(" — ").Append(source.Authors);
            if (!string.IsNullOrWhiteSpace(source.PublicationYear)) sb.Append(" (").Append(source.PublicationYear).Append(')');
            sb.Append(". [Source 1]");
            return new DeterministicAnswer(sb.ToString(), [source]);
        }

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
                    FullExcerpt = chunk.Text.Length > 4000 ? chunk.Text[..4000] + "…" : chunk.Text,
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
