// server/Services/AI/Agent/AgentToolbox.cs
//
// Implementation of the agent's tool layer — the "actions" the planner can
// choose from. Every tool returns a ToolExecutionResult carrying:
//   - Observation: plain text fed back into the planner/synthesizer prompt
//   - Sources:     structured ChatSourceDto citations that are merged into
//                  the final answer's source list
//
// Tools (and why they exist):
//   1. semantic_search  — dense retrieval over thesis abstracts (Pinecone +
//                        text-embedding-3-small). The default research tool.
//   2. keyword_search   — exact-match LIKE search over Azure SQL theses
//                        (titles + abstracts). Catches acronyms and exact
//                        names that embeddings miss; this is the "hybrid"
//                        retrieval half.
//   3. thesis_metadata  — full SQL record for one thesis by id, letting the
//                        agent drill into a document surfaced by a search.
//
// The toolbox is auto-registered by Scrutor (namespace server.Services.AI,
// interface IAgentToolbox).

using System.Text;
using System.Text.Json;
using server.Models.Agent;
using server.Models.DTOs.ChatMessage;
using server.Models.Retrieval;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

namespace server.Services.AI.Agent
{
    public class AgentToolbox : IAgentToolbox
    {
        private readonly IPineconeService _pineconeService;
        private readonly IThesisRepository _thesisRepository;
        private readonly ILogger<AgentToolbox> _logger;

        /// <summary>Characters of a source's text included in prompt observations — keeps the context window small.</summary>
        private const int SnippetLength = 400;

        /// <summary>Hard cap per tool observation so one call cannot blow up the prompt.</summary>
        private const int MaxObservationLength = 4000;

        public AgentToolbox(IPineconeService pineconeService, IThesisRepository thesisRepository, ILogger<AgentToolbox> logger)
        {
            _pineconeService = pineconeService;
            _thesisRepository = thesisRepository;
            _logger = logger;
        }

        /// <summary>
        /// Tool descriptions injected into the planner system prompt. Kept
        /// byte-for-byte identical to the block used when the prompting recipe
        /// was validated against the live Phi-4-mini deployment — see
        /// AgentPrompts for details before editing.
        /// </summary>
        public string GetToolManifest() =>
            """
            1. semantic_search — meaning-based search over thesis abstracts. DEFAULT choice for research questions. toolArgs: {"query": string, "topK"?: int, "yearFrom"?: int, "yearTo"?: int}
            2. keyword_search — exact-word search over titles/abstracts. ONLY for exact acronyms, standard numbers, or exact titles. toolArgs: {"term": string, "limit"?: int}
            3. thesis_metadata — full record of one thesis. ONLY when a thesisId is already known. toolArgs: {"thesisId": string}
            """;

        /// <inheritdoc />
        public async Task<ToolExecutionResult> ExecuteAsync(string toolName, JsonElement? arguments, CancellationToken cancellationToken = default)
        {
            try
            {
                return toolName switch
                {
                    "semantic_search" => await SemanticSearchAsync(arguments, cancellationToken),
                    "keyword_search" => await KeywordSearchAsync(arguments, cancellationToken),
                    "thesis_metadata" => await ThesisMetadataAsync(arguments, cancellationToken),
                    _ => new ToolExecutionResult(
                        Observation: $"Unknown tool '{toolName}'. Valid tools: semantic_search, keyword_search, thesis_metadata.",
                        Sources: []),
                };
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Tool {Tool} failed", toolName);
                // The agent can recover: the failure becomes an observation.
                return new ToolExecutionResult(
                    Observation: $"Tool '{toolName}' failed: {ex.Message}. Try a different tool or finish with what you have.",
                    Sources: []);
            }
        }

        // ─────────────────── semantic_search (Pinecone) ───────────────────

        private async Task<ToolExecutionResult> SemanticSearchAsync(JsonElement? arguments, CancellationToken ct)
        {
            // The planner occasionally swaps argument keys between the two
            // search tools; accept either name rather than wasting a retry.
            var query = AgentJson.GetStringArg(arguments, "query")
                        ?? AgentJson.GetStringArg(arguments, "term");
            if (string.IsNullOrWhiteSpace(query))
            {
                return new ToolExecutionResult(
                    Observation: "semantic_search failed: the 'query' argument is required.",
                    Sources: []);
            }

            var options = new RetrievalOptions
            {
                TopK = AgentJson.GetIntArg(arguments, "topK"),
                YearFrom = AgentJson.GetIntArg(arguments, "yearFrom"),
                YearTo = AgentJson.GetIntArg(arguments, "yearTo"),
                ThesisId = AgentJson.GetStringArg(arguments, "thesisId"),
            };

            var chunks = await _pineconeService.RetrieveRelevantChunksAsync(query, options, ct);
            var sources = chunks.Select(ToSource).ToList();

            return new ToolExecutionResult(
                Observation: FormatSources(sources),
                Sources: sources);
        }

        // ─────────────────── keyword_search (Azure SQL) ───────────────────

        private async Task<ToolExecutionResult> KeywordSearchAsync(JsonElement? arguments, CancellationToken ct)
        {
            // Alias tolerance — see SemanticSearchAsync.
            var term = AgentJson.GetStringArg(arguments, "term")
                       ?? AgentJson.GetStringArg(arguments, "query");
            if (string.IsNullOrWhiteSpace(term))
            {
                return new ToolExecutionResult(
                    Observation: "keyword_search failed: the 'term' argument is required.",
                    Sources: []);
            }

            var limit = Math.Clamp(AgentJson.GetIntArg(arguments, "limit") ?? 5, 1, 10);
            var theses = await _thesisRepository.SearchByKeywordAsync(term, limit, ct);

            var sources = theses.Select(t => new ChatSourceDto
            {
                ThesisId = t.Id.ToString(),
                Title = t.Title,
                Authors = null, // author names live in the PDF/Pinecone metadata, not the SQL table
                PublicationYear = t.SubmittedAt?.Year.ToString(),
                Snippet = Truncate(t.Abstract, SnippetLength),
                Score = null,
                Url = t.FilePath,
            }).ToList();

            var sb = new StringBuilder();
            sb.Append("keyword_search('").Append(term).Append("') found ").Append(sources.Count).Append(" theses:");
            foreach (var s in sources)
            {
                sb.Append("\n- [").Append(s.ThesisId).Append("] ").Append(s.Title ?? "Untitled");
                if (s.PublicationYear is not null) sb.Append(" (").Append(s.PublicationYear).Append(')');
                if (!string.IsNullOrEmpty(s.Snippet)) sb.Append(" — ").Append(s.Snippet);
            }

            // Keyword search rarely finds short phrases verbatim — always
            // nudge the planner toward semantic_search when nothing matches
            // rather than burning another step on a failing approach.
            if (sources.Count == 0)
            {
                sb.Append("\nNote: keyword_search matches EXACT phrases in titles/abstracts. Consider semantic_search for meaning-based search.");
            }

            return new ToolExecutionResult(
                Observation: Truncate(sb.ToString(), MaxObservationLength),
                Sources: sources);
        }

        // ─────────────────── thesis_metadata (Azure SQL) ───────────────────

        private async Task<ToolExecutionResult> ThesisMetadataAsync(JsonElement? arguments, CancellationToken ct)
        {
            var id = AgentJson.GetStringArg(arguments, "thesisId");
            if (string.IsNullOrWhiteSpace(id) || !Guid.TryParse(id, out var thesisId))
            {
                return new ToolExecutionResult(
                    Observation: "thesis_metadata failed: 'thesisId' must be a valid GUID.",
                    Sources: []);
            }

            var thesis = await _thesisRepository.GetThesisByIdAsync(thesisId);
            if (thesis is null)
            {
                return new ToolExecutionResult(
                    Observation: $"thesis_metadata: no thesis with id {thesisId} exists.",
                    Sources: []);
            }

            var source = new ChatSourceDto
            {
                ThesisId = thesis.Id.ToString(),
                Title = thesis.Title,
                Authors = null,
                PublicationYear = thesis.SubmittedAt?.Year.ToString(),
                Snippet = Truncate(thesis.Abstract, SnippetLength),
                Score = null,
                Url = thesis.FilePath,
            };

            var sb = new StringBuilder();
            sb.Append("Thesis record:\n");
            sb.Append("  Id: ").Append(thesis.Id).Append('\n');
            sb.Append("  Title: ").Append(thesis.Title ?? "Untitled").Append('\n');
            sb.Append("  Status: ").Append(thesis.Status ?? "Unknown").Append('\n');
            sb.Append("  Submitted: ").Append(thesis.SubmittedAt?.ToString("yyyy-MM-dd") ?? "n.d.").Append('\n');
            sb.Append("  Abstract: ").Append(Truncate(thesis.Abstract, SnippetLength));

            return new ToolExecutionResult(
                Observation: Truncate(sb.ToString(), MaxObservationLength),
                Sources: [source]);
        }

        // ─────────────────── shared helpers ───────────────────

        private static ChatSourceDto ToSource(Chunk chunk) => new()
        {
            ThesisId = chunk.ThesisId,
            Title = chunk.Title,
            Authors = chunk.Authors,
            PublicationYear = chunk.PublicationYear,
            Snippet = Truncate(chunk.Text, SnippetLength),
            Score = double.TryParse(chunk.RelevanceScore, out var score) ? score : null,
            Url = chunk.Url,
        };

        /// <summary>Formats retrieved chunks as the numbered "[Source n]" block used by the synthesizer prompt.</summary>
        private static string FormatSources(IReadOnlyList<ChatSourceDto> sources)
        {
            if (sources.Count == 0)
            {
                return "semantic_search: no relevant chunks passed the relevance threshold. Try rephrasing the query or use keyword_search.";
            }

            var sb = new StringBuilder();
            sb.Append("semantic_search retrieved ").Append(sources.Count).Append(" relevant passages:");
            for (var i = 0; i < sources.Count; i++)
            {
                var s = sources[i];
                sb.Append("\n- [Source ").Append(i + 1).Append("] ")
                  .Append(s.Title ?? "Untitled")
                  .Append(" | Author(s): ").Append(string.IsNullOrWhiteSpace(s.Authors) ? "Unknown" : s.Authors)
                  .Append(" | Year: ").Append(string.IsNullOrWhiteSpace(s.PublicationYear) ? "n.d." : s.PublicationYear)
                  .Append(" | ThesisId: ").Append(s.ThesisId ?? "n/a");
                if (s.Snippet is not null)
                {
                    sb.Append("\n  Excerpt: ").Append(s.Snippet);
                }
            }
            return Truncate(sb.ToString(), MaxObservationLength);
        }

        private static string? Truncate(string? text, int maxLength)
        {
            if (string.IsNullOrEmpty(text) || text.Length <= maxLength) return text;
            return text[..maxLength] + "…";
        }
    }
}
