// server/Services/AI/PineconeService.cs
//
// Pinecone + Azure OpenAI embedding integration — the vector-store layer of
// the RAG pipeline. METADATA-ONLY: one vector per thesis.
//
// ── INGESTION (called by ThesisService.IngestAsync) ─────────────────────────
//   one text-embedding-3-small call embeds BuildMetadataEmbeddingText: a
//   Title/Authors/Publication year header above the abstract, so "studies by
//   <author>" and year-bounded questions can match — the abstract alone never
//   contains author names or years. metadata["abstract"] keeps the RAW
//   excerpt for citations/prompts. The vector id is deterministic
//   (thesis_{id}_meta), so re-ingesting the same thesis REPLACES its vector.
//
// ── RETRIEVAL (called by the agent's semantic_search tool, the deterministic
//   fast path, and catalog semantic search) ──────────────────────────────────
//   query ──> DetectYearRange (fills YearFrom/YearTo from years in the query
//             when the planner omitted them — small models do that often)
//          ──> one embedding call ──> Pinecone QueryAsync(TopK, Filter) on
//             the METADATA namespace only
//          ──> score-threshold filter ──> mapped to Chunk records (with the
//              real match score and thesis_id for citation linking)
//
// ── DELETION ────────────────────────────────────────────────────────────────
//   DeleteThesisVectorsAsync filter-deletes by thesis_id in every namespace,
//   then prefix-scans for legacy thesis_{id}_chunk_* ids (pre-metadata-only
//   full-text vectors, which may still sit in the default namespace) and
//   deletes the deterministic metadata id. This keeps re-ingestion idempotent
//   and removes vectors when a thesis is edited or deleted.

using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using OpenAI.Embeddings;
using Pinecone;
using server.Configuration;
using server.Models.Retrieval;
using server.Services.Interfaces;

namespace server.Services.AI
{
    public class PineconeService : IPineconeService
    {
        private readonly PineconeClient _pineconeClient;
        private readonly EmbeddingClient _embeddingClient;
        private readonly ILogger<PineconeService> _logger;
        private readonly PineconeConfig _config;

        /// <summary>Upper bound on vector IDs collected per prefix-list loop (guards against runaway pagination).</summary>
        private const int MaxDeleteScan = 1000;

        public PineconeService(
            PineconeClient pineconeClient,
            EmbeddingClient embeddingClient,
            ILogger<PineconeService> logger,
            IOptions<PineconeConfig> config)
        {
            _pineconeClient = pineconeClient;
            _embeddingClient = embeddingClient;
            _logger = logger;
            _config = config.Value;
        }

        private string IndexName =>
            string.IsNullOrWhiteSpace(_config.IndexName) ? "research-assistant-abstracts" : _config.IndexName;

        /// <summary>Namespace of the per-thesis metadata vector (thesis_{id}_meta).</summary>
        private string MetadataNamespace => _config.MetadataNamespace;

        // ────────────────────────── RETRIEVAL ──────────────────────────

        public async Task<List<Chunk>> RetrieveRelevantChunksAsync(
            string query,
            RetrievalOptions? options = null,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(query))
            {
                _logger.LogWarning("Semantic search called with an empty query");
                return new List<Chunk>();
            }

            // Planner-supplied years win; otherwise detect them in the query
            // text itself. Small models often omit yearFrom/yearTo despite the
            // few-shot examples, and the agent's guaranteed fallback passes no
            // options at all — without this, "published in 2019" would only
            // match on topic similarity (the year is not part of the embedding
            // input for older vectors).
            options = DetectYearRange(query, options);

            // 1. Embed the query once per turn (text-embedding-3-small).
            //    (The explicit OpenAIEmbedding type triggers the implicit
            //    ClientResult -> model conversion.)
            OpenAIEmbedding embeddingResult = await _embeddingClient.GenerateEmbeddingAsync(query, cancellationToken: cancellationToken);
            var queryVector = embeddingResult.ToFloats().ToArray();

            var topK = (uint)Math.Clamp(options?.TopK ?? _config.TopK, 1, 50);
            var filter = BuildFilter(options);
            var index = _pineconeClient.Index(IndexName);

            // 2. Query the metadata namespace — the ONLY namespace that holds
            //    vectors (one per thesis: title/author/year/abstract).
            var request = new QueryRequest
            {
                Vector = queryVector,
                TopK = topK,
                IncludeMetadata = true,
                IncludeValues = false,
                Namespace = MetadataNamespace,
            };
            if (filter is not null) request.Filter = filter;

            var response = await index.QueryAsync(request, cancellationToken: cancellationToken);
            List<(float Score, Metadata? Metadata)> matches = response?.Matches?
                .Select(m => (m.Score ?? 0f, m.Metadata))
                .ToList() ?? new List<(float Score, Metadata? Metadata)>();

            if (matches.Count == 0)
            {
                _logger.LogInformation("Pinecone returned no matches for the query");
                return new List<Chunk>();
            }

            // 3. Drop below-threshold matches so junk never reaches the LLM prompt.
            var threshold = options?.ScoreThreshold ?? _config.ScoreThreshold;

            var chunks = matches
                .Where(match => match.Score >= threshold)
                .OrderByDescending(match => match.Score)
                .Select(match =>
                {
                    var metadata = match.Metadata;
                    return new Chunk(
                        Text: GetString(metadata, "abstract") ?? string.Empty,
                        Title: GetString(metadata, "title"),
                        Url: GetString(metadata, "url"),
                        Authors: GetString(metadata, "authors"),
                        PublicationYear: GetString(metadata, "publication_year"),
                        Journal: GetString(metadata, "journal"),
                        RelevanceScore: match.Score.ToString("0.###"),
                        ThesisId: GetString(metadata, "thesis_id"));
                })
                .Where(c => !string.IsNullOrWhiteSpace(c.Text))
                .ToList();

            _logger.LogInformation(
                "Pinecone returned {Total} matches, {Kept} passed the {Threshold} score threshold",
                matches.Count, chunks.Count, threshold);

            return chunks;
        }

        /// <summary>
        /// Fills YearFrom/YearTo from 4-digit years appearing in the query
        /// ("published in 2019", "between 2019 and 2022") when the caller did
        /// not supply a range. One year = exact-year filter; several = the
        /// min/max span. Ranges/thesis filters already set on <paramref name="options"/>
        /// are preserved, and planner-passed years always win.
        /// </summary>
        private static RetrievalOptions? DetectYearRange(string query, RetrievalOptions? options)
        {
            if (options is not null && (options.YearFrom is not null || options.YearTo is not null))
                return options;

            var years = Regex.Matches(query, @"\b(?:19|20)\d{2}\b")
                .Select(match => int.Parse(match.Value))
                .Where(year => year >= 1900 && year <= DateTime.UtcNow.Year + 1)
                .Distinct()
                .ToList();

            if (years.Count == 0) return options;

            return new RetrievalOptions
            {
                TopK = options?.TopK,
                ScoreThreshold = options?.ScoreThreshold,
                ThesisId = options?.ThesisId,
                YearFrom = years.Min(),
                YearTo = years.Max(),
            };
        }

        /// <summary>
        /// Builds a Pinecone metadata filter from retrieval options (exact thesis match and/or year span).
        ///
        /// The year condition enumerates the span into a <c>$in</c> list of strings
        /// instead of $gte/$lte: Pinecone's range operators are NUMBER-only, while
        /// publication_year has ALWAYS been stored as a string ("2020") — sending
        /// string ranges made year-filtered queries fail outright, which is why
        /// "published in 2019" returned nothing. $in does equality matching on the
        /// stored values; a year span is at most a few hundred entries (Pinecone
        /// allows 10,000 per $in).
        /// </summary>
        private static Metadata? BuildFilter(RetrievalOptions? options)
        {
            if (options is null) return null;

            Metadata? filter = null;

            if (!string.IsNullOrWhiteSpace(options.ThesisId))
            {
                filter ??= new Metadata();
                filter["thesis_id"] = options.ThesisId;
            }

            if (options.YearFrom is not null || options.YearTo is not null)
            {
                // Clamp so a bogus planner arg cannot fan the list out.
                var from = Math.Clamp(options.YearFrom ?? 1900, 1900, 2100);
                var to = Math.Clamp(options.YearTo ?? DateTime.UtcNow.Year, 1900, 2100);
                if (from > to) (from, to) = (to, from);

                var years = new List<MetadataValue>(to - from + 1);
                for (var year = from; year <= to; year++)
                {
                    years.Add(year.ToString());
                }

                // $in must be wrapped in an operator object: {"publication_year":
                // {"$in": [...]}} — a bare array is INVALID_ARGUMENT (gRPC 3).
                filter ??= new Metadata();
                filter["publication_year"] = new Metadata
                {
                    ["$in"] = new MetadataValue(years)
                };
            }

            return filter;
        }

        private static string? GetString(Metadata? metadata, string key)
        {
            if (metadata is null || !metadata.TryGetValue(key, out var value) || value is null)
                return null;

            // MetadataValue.ToString() JSON-serializes the wrapped value, so
            // strings come back WITH surrounding double quotes (and inner
            // quotes escaped): "c09a9d58-…". Unwrapping the OneOf's string arm
            // directly keeps thesis_id / url / title / authors / the abstract
            // excerpt free of stray quotes in citations, prompts and API URLs.
            // Non-string arms serialize as bare JSON scalars (0, true) anyway.
            return value.IsT0 ? value.AsT0 : value.ToString();
        }

        // ────────────────────────── INGESTION ──────────────────────────

        /// <inheritdoc />
        public async Task<int> UpsertMetadataChunkAsync(
            Guid thesisId,
            Chunk metadataChunk,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(metadataChunk.Text))
            {
                _logger.LogWarning("Cannot upsert metadata vector for thesis {ThesisId}: chunk has no text", thesisId);
                return 0;
            }

            try
            {
                // One embedding call: Title/Authors/Year header above the
                // abstract so author/year questions match. The explicit
                // OpenAIEmbedding type triggers the implicit ClientResult ->
                // model conversion.
                OpenAIEmbedding embeddingResult = await _embeddingClient.GenerateEmbeddingAsync(
                    BuildMetadataEmbeddingText(metadataChunk), cancellationToken: cancellationToken);
                var embedding = embeddingResult.ToFloats().ToArray();

                var uploadedAt = DateTime.UtcNow.ToString("o");
                var metadata = new Metadata
                {
                    ["abstract"] = metadataChunk.Text!,
                    ["thesis_id"] = metadataChunk.ThesisId ?? thesisId.ToString(),
                    ["chunk_index"] = -1,
                    ["kind"] = "metadata",
                    ["uploaded_at"] = uploadedAt,
                };

                if (!string.IsNullOrEmpty(metadataChunk.Title)) metadata["title"] = metadataChunk.Title;
                if (!string.IsNullOrEmpty(metadataChunk.Url)) metadata["url"] = metadataChunk.Url;
                if (!string.IsNullOrEmpty(metadataChunk.Authors)) metadata["authors"] = metadataChunk.Authors;
                if (!string.IsNullOrEmpty(metadataChunk.PublicationYear)) metadata["publication_year"] = metadataChunk.PublicationYear;
                if (!string.IsNullOrEmpty(metadataChunk.Journal)) metadata["journal"] = metadataChunk.Journal;

                var index = _pineconeClient.Index(IndexName);
                // Upserting the same id REPLACES the previous vector — this is
                // what makes re-ingestion refresh metadata without a delete.
                await index.UpsertAsync(
                    new UpsertRequest
                    {
                        Namespace = MetadataNamespace,
                        Vectors = [new Vector
                        {
                            Id = $"thesis_{thesisId}_meta",
                            Values = embedding,
                            Metadata = metadata,
                        }]
                    },
                    cancellationToken: cancellationToken);

                _logger.LogInformation(
                    "Metadata vector upserted for thesis {ThesisId} into {Index}/{Namespace}",
                    thesisId, IndexName, MetadataNamespace);
                return 1;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to upsert metadata vector for thesis {ThesisId}", thesisId);
                return 0;
            }
        }

        /// <summary>
        /// What actually gets embedded: a short metadata header above the raw
        /// abstract. Author names and publication years never appear inside
        /// abstract text, so embedding the text alone made "studies authored
        /// by X" unmatchable. The header fixes ingestions; the stored
        /// "abstract" metadata key keeps the raw excerpt so citations and
        /// prompt excerpts are unaffected.
        /// </summary>
        private static string BuildMetadataEmbeddingText(Chunk chunk)
        {
            var sb = new StringBuilder();
            if (!string.IsNullOrEmpty(chunk.Title))
                sb.Append("Title: ").AppendLine(chunk.Title);
            if (!string.IsNullOrEmpty(chunk.Authors))
                sb.Append("Authors: ").AppendLine(chunk.Authors);
            if (!string.IsNullOrEmpty(chunk.PublicationYear))
                sb.Append("Publication year: ").AppendLine(chunk.PublicationYear);
            sb.Append("Abstract: ").Append(chunk.Text);
            return sb.ToString();
        }

        // ────────────────────────── DELETION ──────────────────────────

        public async Task<int> DeleteThesisVectorsAsync(Guid thesisId, CancellationToken cancellationToken = default)
        {
            var index = _pineconeClient.Index(IndexName);

            // 1. Filter delete across every namespace: the metadata vector and
            //    any legacy full-text chunks still sitting in the pre-split
            //    default namespace.
            foreach (var ns in DistinctNamespaces())
            {
                try
                {
                    await index.DeleteAsync(
                        new DeleteRequest
                        {
                            Namespace = ns,
                            Filter = new Metadata { ["thesis_id"] = thesisId.ToString() },
                        },
                        cancellationToken: cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Filter-based delete failed for thesis {ThesisId} in {Namespace} — continuing with prefix delete", thesisId, ns);
                }
            }

            // 2. Prefix scan catches legacy body vectors (thesis_{id}_chunk_*)
            //    without thesis_id metadata in the default namespace.
            var removedByIds = await DeleteByPrefixAsync(thesisId, cancellationToken);

            // 3. Remove the metadata vector by its deterministic id.
            try
            {
                await index.DeleteAsync(
                    new DeleteRequest
                    {
                        Namespace = MetadataNamespace,
                        Ids = [$"thesis_{thesisId}_meta"],
                    },
                    cancellationToken: cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Metadata vector delete failed for thesis {ThesisId}", thesisId);
            }

            return removedByIds;
        }

        /// <summary>
        /// All namespaces that may hold thesis vectors: the metadata namespace
        /// and the pre-split default namespace — deduplicated so a configured
        /// default metadata namespace is not scanned twice.
        /// </summary>
        private string[] DistinctNamespaces() =>
            new[] { MetadataNamespace, LegacyNamespace }
                .Distinct(StringComparer.Ordinal)
                .ToArray();

        /// <summary>
        /// The pre-split layout stored every vector in Pinecone's built-in
        /// default namespace — still scanned on delete until old indexes are
        /// migrated.
        /// </summary>
        private const string LegacyNamespace = "__default__";

        /// <summary>
        /// Lists vector IDs by the deterministic "thesis_{id}_chunk_" prefix
        /// (paginated, scan-capped) and deletes them in one request. Catches
        /// legacy full-text chunks from the pre-metadata-only pipeline.
        /// </summary>
        private async Task<int> DeleteByPrefixAsync(Guid thesisId, CancellationToken cancellationToken)
        {
            var index = _pineconeClient.Index(IndexName);
            var removedByIds = 0;

            foreach (var ns in DistinctNamespaces())
            {
                try
                {
                    var prefix = $"thesis_{thesisId}_chunk_";
                    var ids = new List<string>();
                    string? paginationToken = null;

                    do
                    {
                        var listRequest = new ListRequest { Prefix = prefix, Limit = 100, Namespace = ns };
                        if (!string.IsNullOrEmpty(paginationToken))
                        {
                            listRequest.PaginationToken = paginationToken;
                        }

                        var listResponse = await index.ListAsync(listRequest, cancellationToken: cancellationToken);
                        if (listResponse?.Vectors is null) break;

                        ids.AddRange(listResponse.Vectors
                            .Select(v => v.Id)
                            .Where(id => !string.IsNullOrEmpty(id))!);

                        paginationToken = listResponse.Pagination?.Next;
                    } while (!string.IsNullOrEmpty(paginationToken) && ids.Count < MaxDeleteScan);

                    if (ids.Count > 0)
                    {
                        await index.DeleteAsync(new DeleteRequest { Namespace = ns, Ids = ids }, cancellationToken: cancellationToken);
                        removedByIds += ids.Count;
                        _logger.LogInformation("Deleted {Count} vectors for thesis {ThesisId} from {Namespace} (prefix scan)", ids.Count, thesisId, ns);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Prefix-based vector cleanup failed for thesis {ThesisId} in {Namespace}", thesisId, ns);
                }
            }

            return removedByIds;
        }
    }
}
