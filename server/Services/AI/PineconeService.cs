// server/Services/AI/PineconeService.cs
//
// Pinecone + Azure OpenAI embedding integration — the vector-store layer of
// the RAG pipeline.
//
// ── INGESTION (called by ThesisService.IngestAsync) ─────────────────────────
//   chunks ──> EmbedBatchAsync (16 texts per text-embedding-3-small call,
//              instead of one HTTP request per chunk). What gets EMBEDDED is
//              BuildEmbeddingText: a Title/Authors/Publication year header
//              above the abstract, so "studies by <author>" and year-bounded
//              questions can match — the abstract alone never contains
//              author names or years. metadata["abstract"] keeps the RAW
//              excerpt for citations/prompts.
//          ──> one bulk UpsertRequest per 100 vectors, with metadata:
//              abstract, title, url (blob path, NEVER a SAS link), authors,
//              publication_year, journal, thesis_id, chunk_index, uploaded_at
//
// ── RETRIEVAL (called by the agent's semantic_search tool and the fallback
//   RAG path) ────────────────────────────────────────────────────────────────
//   query ──> DetectYearRange (fills YearFrom/YearTo from years in the query
//             when the planner omitted them — small models do that often)
//          ──> one embedding call ──> Pinecone QueryAsync(TopK, Filter)
//          ──> score-threshold filter ──> mapped to Chunk records (with the
//              real match score and thesis_id for citation linking)
//
// ── DELETION ────────────────────────────────────────────────────────────────
//   DeleteThesisVectorsAsync lists vector IDs by the "thesis_{id}_chunk_"
//   prefix (paginated) and deletes them, then also deletes by the thesis_id
//   metadata filter. This keeps re-ingestion idempotent and removes vectors
//   when a thesis is edited or deleted.

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

        /// <summary>Namespace of body chunks (thesis_{id}_chunk_*).</summary>
        private string BodyNamespace => _config.BodyNamespace;

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
            // text itself. Phi-4-mini often omits yearFrom/yearTo despite the
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

            // 2. Query BOTH namespaces with the same vector/filter: the
            //    metadata namespace holds the abstract-level vector, the body
            //    namespace holds full-text section chunks. Merging by score
            //    lets a citation come from whichever is the better match.
            var matches = new List<(float Score, Metadata? Metadata)>();
            foreach (var ns in new[] { MetadataNamespace, BodyNamespace })
            {
                var request = new QueryRequest
                {
                    Vector = queryVector,
                    TopK = topK,
                    IncludeMetadata = true,
                    IncludeValues = false,
                    Namespace = ns,
                };
                if (filter is not null) request.Filter = filter;

                var response = await index.QueryAsync(request, cancellationToken: cancellationToken);
                if (response?.Matches is null)
                {
                    _logger.LogInformation("Pinecone returned no matches from namespace {Namespace}", ns);
                    continue;
                }
                matches.AddRange(response.Matches.Select(m => (m.Score ?? 0f, m.Metadata)));
            }

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
                        // Body chunks store their excerpt under "text"
                        // (namespace full-text-chunks); the metadata vector and
                        // legacy vectors store it under "abstract".
                        Text: GetString(metadata, "text") ?? GetString(metadata, "abstract") ?? string.Empty,
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
                "Pinecone returned {Total} merged matches across namespaces, {Kept} passed the {Threshold} score threshold",
                matches.Count, chunks.Count, threshold);


            _logger.LogInformation(
    "Pinecone returned {Total} merged matches across namespaces, {Kept} passed the {Threshold} score threshold",
    matches.Count, chunks.Count, threshold);

// Raw retrieved text, one log entry per chunk
for (var i = 0; i < chunks.Count; i++)
{
    var c = chunks[i];
    _logger.LogInformation(
        "Chunk {Rank} | score={Score} | thesis={ThesisId} | title={Title}\n{Text}",
        i + 1, c.RelevanceScore, c.ThesisId, c.Title, c.Text);
}
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
                // Same embedding recipe as body chunks (Title/Authors/Year
                // header above the text) so author/year questions match the
                // metadata vector too. The explicit OpenAIEmbedding type
                // triggers the implicit ClientResult -> model conversion.
                OpenAIEmbedding embeddingResult = await _embeddingClient.GenerateEmbeddingAsync(
                    BuildEmbeddingText(metadataChunk, isBody: false), cancellationToken: cancellationToken);
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
                // what makes catalog edits refresh metadata without a delete.
                // The metadata vector lives in its own namespace, separate from
                // body chunks.
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

        public async Task<int> UpsertAbstractsAsync(
            Guid thesisId,
            IReadOnlyList<Chunk> chunks,
            CancellationToken cancellationToken = default)
        {
            var valid = chunks
                .Where(c => !string.IsNullOrWhiteSpace(c.Text))
                .ToList();

            if (valid.Count == 0)
            {
                _logger.LogWarning("Cannot upsert thesis {ThesisId}: no chunk has text content", thesisId);
                return 0;
            }

            try
            {
                // 1. Batch-embed all chunk texts (EmbeddingBatchSize per call).
                //    The embedded string carries a Title/Authors/Publication
                //    year header so author and year questions can match — the
                //    stored "text" metadata below stays the raw excerpt.
                var texts = valid.Select(c => BuildEmbeddingText(c, isBody: true)).ToList();
                var embeddings = await EmbedBatchAsync(texts, cancellationToken);

                // 2. Build vectors with full metadata. Body chunks live in the
                //    body namespace and store their excerpt under "text" —
                //    NOT "abstract" (that key belongs to the metadata vector's
                //    thesis abstract; mixing them made chapter text cite as a
                //    fake abstract).
                var uploadedAt = DateTime.UtcNow.ToString("o");
                var vectors = new List<Vector>(valid.Count);
                for (var i = 0; i < valid.Count; i++)
                {
                    var chunk = valid[i];
                    var metadata = new Metadata
                    {
                        ["text"] = chunk.Text!,
                        ["thesis_id"] = chunk.ThesisId ?? thesisId.ToString(),
                        ["chunk_index"] = i,
                        ["kind"] = "body",
                        ["uploaded_at"] = uploadedAt,
                    };

                    if (!string.IsNullOrEmpty(chunk.Title)) metadata["title"] = chunk.Title;
                    if (!string.IsNullOrEmpty(chunk.Url)) metadata["url"] = chunk.Url;
                    if (!string.IsNullOrEmpty(chunk.Authors)) metadata["authors"] = chunk.Authors;
                    if (!string.IsNullOrEmpty(chunk.PublicationYear)) metadata["publication_year"] = chunk.PublicationYear;
                    if (!string.IsNullOrEmpty(chunk.Journal)) metadata["journal"] = chunk.Journal;

                    vectors.Add(new Vector
                    {
                        Id = $"thesis_{thesisId}_chunk_{i}",
                        Values = embeddings[i],
                        Metadata = metadata,
                    });
                }

                // 3. Bulk upsert (batched to keep requests within Pinecone limits).
                var index = _pineconeClient.Index(IndexName);
                var upserted = 0;
                foreach (var batch in vectors.Chunk(Math.Clamp(_config.MaxUpsertBatchSize, 1, 1000)))
                {
                    var response = await index.UpsertAsync(
                        new UpsertRequest { Namespace = BodyNamespace, Vectors = batch },
                        cancellationToken: cancellationToken);
                    upserted += (int)(response?.UpsertedCount ?? 0);
                }

                _logger.LogInformation(
                    "Thesis {ThesisId}: {Upserted}/{Total} body vectors upserted into {Index}/{Namespace}",
                    thesisId, upserted, vectors.Count, IndexName, BodyNamespace);

                return upserted;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to upsert abstract chunks for thesis {ThesisId} into index {Index}", thesisId, IndexName);
                return 0;
            }
        }

        /// <summary>
        /// What actually gets embedded: a short metadata header above the raw
        /// text. Author names and publication years never appear inside
        /// abstract/chapter text, so embedding the text alone made
        /// "studies authored by X" unmatchable. The header fixes new
        /// ingestions; the stored "text"/"abstract" metadata key keeps the raw
        /// excerpt so citations and prompt excerpts are unaffected.
        /// </summary>
        private static string BuildEmbeddingText(Chunk chunk, bool isBody)
        {
            var sb = new StringBuilder();
            if (!string.IsNullOrEmpty(chunk.Title))
                sb.Append("Title: ").AppendLine(chunk.Title);
            if (!string.IsNullOrEmpty(chunk.Authors))
                sb.Append("Authors: ").AppendLine(chunk.Authors);
            if (!string.IsNullOrEmpty(chunk.PublicationYear))
                sb.Append("Publication year: ").AppendLine(chunk.PublicationYear);
            // Body chunks are chapter excerpts, not abstracts — labeling them
            // "Abstract:" taught the model that chapter text IS an abstract.
            sb.Append(isBody ? "Excerpt: " : "Abstract: ").Append(chunk.Text);
            return sb.ToString();
        }

        /// <summary>Embeds texts in batches of EmbeddingBatchSize (max 16 per Azure OpenAI request).</summary>
        private async Task<float[][]> EmbedBatchAsync(IReadOnlyList<string> texts, CancellationToken cancellationToken)
        {
            var results = new float[texts.Count][];
            var batchSize = Math.Clamp(_config.EmbeddingBatchSize, 1, 16);

            for (var offset = 0; offset < texts.Count; offset += batchSize)
            {
                var batch = texts.Skip(offset).Take(batchSize).ToList();
                var collection = await _embeddingClient.GenerateEmbeddingsAsync(batch, cancellationToken: cancellationToken);

                var i = 0;
                foreach (var embedding in collection.Value)
                {
                    results[offset + i] = embedding.ToFloats().ToArray();
                    i++;
                }
            }

            return results;
        }

        // ────────────────────────── DELETION ──────────────────────────

        public async Task<int> DeleteThesisVectorsAsync(Guid thesisId, CancellationToken cancellationToken = default)
        {
            var index = _pineconeClient.Index(IndexName);

            // 1. Filter delete across every namespace: body chunks, the
            //    metadata vector, and any legacy vectors still sitting in the
            //    pre-split default namespace.
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

            // 2. Prefix scan catches vectors without thesis_id metadata
            //    (current body namespace + legacy default namespace).
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

        /// <inheritdoc />
        public async Task<int> DeleteBodyVectorsAsync(Guid thesisId, CancellationToken cancellationToken = default)
        {
            // Prefix-only: thesis_{id}_chunk_* never matches the metadata
            // vector's id (thesis_{id}_meta), so the already-citable metadata
            // chunk survives a body re-ingest. Scans the body namespace AND
            // the legacy default namespace (pre-split body vectors).
            return await DeleteByPrefixAsync(thesisId, cancellationToken);
        }

        /// <summary>
        /// All namespaces that may hold thesis vectors: metadata, body, and
        /// the pre-split default namespace — deduplicated so a configured
        /// default metadata namespace is not scanned twice.
        /// </summary>
        private string[] DistinctNamespaces() =>
            new[] { MetadataNamespace, BodyNamespace, LegacyNamespace }
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
        /// (paginated, scan-capped) and deletes them in one request. Scans the
        /// body namespace plus the legacy default namespace. Shared by the
        /// full-thesis delete and the body-only delete.
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
