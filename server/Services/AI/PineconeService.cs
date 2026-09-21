// server/Services/AI/PineconeService.cs
//
// Pinecone + Azure OpenAI embedding integration — the vector-store layer of
// the RAG pipeline.
//
// ── INGESTION (called by ThesisService.IngestAsync) ─────────────────────────
//   chunks ──> EmbedBatchAsync (16 texts per text-embedding-3-small call,
//              instead of one HTTP request per chunk)
//          ──> one bulk UpsertRequest per 100 vectors, with metadata:
//              abstract, title, url (blob path, NEVER a SAS link), authors,
//              publication_year, journal, thesis_id, chunk_index, uploaded_at
//
// ── RETRIEVAL (called by the agent's semantic_search tool and the fallback
//   RAG path) ────────────────────────────────────────────────────────────────
//   query ──> one embedding call ──> Pinecone QueryAsync(TopK, Filter)
//          ──> score-threshold filter ──> mapped to Chunk records (with the
//              real match score and thesis_id for citation linking)
//
// ── DELETION ────────────────────────────────────────────────────────────────
//   DeleteThesisVectorsAsync lists vector IDs by the "thesis_{id}_chunk_"
//   prefix (paginated) and deletes them, then also deletes by the thesis_id
//   metadata filter. This keeps re-ingestion idempotent and removes vectors
//   when a thesis is edited or deleted.

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

            // 1. Embed the query once per turn (text-embedding-3-small).
            //    (The explicit OpenAIEmbedding type triggers the implicit
            //    ClientResult -> model conversion.)
            OpenAIEmbedding embeddingResult = await _embeddingClient.GenerateEmbeddingAsync(query, cancellationToken: cancellationToken);
            var queryVector = embeddingResult.ToFloats().ToArray();

            // 2. Query Pinecone with optional metadata filters.
            var topK = (uint)Math.Clamp(options?.TopK ?? _config.TopK, 1, 50);
            var request = new QueryRequest
            {
                Vector = queryVector,
                TopK = topK,
                IncludeMetadata = true,
                IncludeValues = false,
            };

            var filter = BuildFilter(options);
            if (filter is not null)
            {
                request.Filter = filter;
            }

            var index = _pineconeClient.Index(IndexName);
            var queryResponse = await index.QueryAsync(request, cancellationToken: cancellationToken);

            if (queryResponse?.Matches is null)
            {
                _logger.LogInformation("Pinecone returned no matches for the query");
                return new List<Chunk>();
            }

            // 3. Drop below-threshold matches so junk never reaches the LLM prompt.
            var threshold = options?.ScoreThreshold ?? _config.ScoreThreshold;

            var chunks = queryResponse.Matches
                .Where(match => (match.Score ?? 0) >= threshold)
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
                        RelevanceScore: match.Score?.ToString("0.###"),
                        ThesisId: GetString(metadata, "thesis_id"));
                })
                .Where(c => !string.IsNullOrWhiteSpace(c.Text))
                .ToList();

            _logger.LogInformation(
                "Pinecone returned {Total} matches, {Kept} passed the {Threshold} score threshold",
                queryResponse.Matches.Count(), chunks.Count, threshold);

            return chunks;
        }

        /// <summary>Builds a Pinecone metadata filter from retrieval options (exact thesis match and/or year range).</summary>
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
                var range = new Metadata();
                if (options.YearFrom is not null)
                {
                    range["$gte"] = options.YearFrom.Value.ToString();
                }
                if (options.YearTo is not null)
                {
                    range["$lte"] = options.YearTo.Value.ToString();
                }
                filter ??= new Metadata();
                filter["publication_year"] = new MetadataValue(range);
            }

            return filter;
        }

        private static string? GetString(Metadata? metadata, string key)
            => metadata is not null && metadata.TryGetValue(key, out var value)
                ? value?.ToString()
                : null;

        // ────────────────────────── INGESTION ──────────────────────────

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
                var texts = valid.Select(c => c.Text!).ToList();
                var embeddings = await EmbedBatchAsync(texts, cancellationToken);

                // 2. Build vectors with full metadata.
                var uploadedAt = DateTime.UtcNow.ToString("o");
                var vectors = new List<Vector>(valid.Count);
                for (var i = 0; i < valid.Count; i++)
                {
                    var chunk = valid[i];
                    var metadata = new Metadata
                    {
                        ["abstract"] = chunk.Text!,
                        ["thesis_id"] = chunk.ThesisId ?? thesisId.ToString(),
                        ["chunk_index"] = i,
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
                        new UpsertRequest { Vectors = batch },
                        cancellationToken: cancellationToken);
                    upserted += (int)(response?.UpsertedCount ?? 0);
                }

                _logger.LogInformation(
                    "Thesis {ThesisId}: {Upserted}/{Total} vectors upserted into index {Index}",
                    thesisId, upserted, vectors.Count, IndexName);

                return upserted;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to upsert abstract chunks for thesis {ThesisId} into index {Index}", thesisId, IndexName);
                return 0;
            }
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
            var removedByIds = 0;

            try
            {
                // 1. Delete by the thesis_id metadata filter (covers every vector
                //    ingested by the current pipeline, whatever its ID shape).
                await index.DeleteAsync(
                    new DeleteRequest { Filter = new Metadata { ["thesis_id"] = thesisId.ToString() } },
                    cancellationToken: cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Filter-based delete failed for thesis {ThesisId} — continuing with prefix delete", thesisId);
            }

            try
            {
                // 2. List IDs by the deterministic "thesis_{id}_chunk_" prefix and
                //    delete them explicitly (also covers legacy vectors that lack
                //    the thesis_id metadata field).
                var prefix = $"thesis_{thesisId}_chunk_";
                var ids = new List<string>();
                string? paginationToken = null;

                do
                {
                    var listRequest = new ListRequest { Prefix = prefix, Limit = 100 };
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
                    await index.DeleteAsync(new DeleteRequest { Ids = ids }, cancellationToken: cancellationToken);
                    removedByIds = ids.Count;
                }

                _logger.LogInformation("Deleted {Count} vectors for thesis {ThesisId} (prefix scan)", removedByIds, thesisId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Prefix-based vector cleanup failed for thesis {ThesisId}", thesisId);
            }

            return removedByIds;
        }
    }
}
