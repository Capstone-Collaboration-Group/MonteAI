using OpenAI.Embeddings;
using Pinecone;
using server.Services.Interfaces;
using server.Models.Retrieval;

namespace server.Services.AI
{
    public class PineconeService : IPineconeService
    {
        private readonly PineconeClient _pineconeClient;
        private readonly EmbeddingClient _embeddingClient;
        private readonly ILogger<PineconeService> _logger;

        private const string IndexName = "research-assistant-abstracts"; // your Pinecone index name
        private const int TopK = 5;                            // how many chunks to retrieve per query

        public PineconeService(
            PineconeClient pineconeClient,
            EmbeddingClient embeddingClient,
            ILogger<PineconeService> logger)
        {
            _pineconeClient = pineconeClient;
            _embeddingClient = embeddingClient;
            _logger = logger;
        }

        public async Task<List<Chunk>> RetrieveRelevantChunksAsync(string query)
        {
            // 1. Embed the query using text-embedding-3-small (Azure OpenAI).
            //    This costs a fraction of a cent per query — see earlier cost breakdown.
            OpenAIEmbedding embeddingResult = await _embeddingClient.GenerateEmbeddingAsync(query);
            float[] queryVector = embeddingResult.ToFloats().ToArray();

            // 2. Query the Pinecone index for the top-k most similar vectors.
            var index = _pineconeClient.Index(IndexName);

            var queryResponse = await index.QueryAsync(new QueryRequest
            {
                Vector = queryVector,
                TopK = TopK,
                IncludeMetadata = true,
                IncludeValues = false // we don't need the raw vectors back, only metadata
            });

            if (queryResponse?.Matches == null || queryResponse.Matches.Count() == 0)
            {
                _logger.LogInformation("Pinecone query returned no matches for query: {Query}", query);
                return new List<Chunk>();
            }

            // 3. Map Pinecone matches into RetrievedChunk objects for the prompt builder.
            //    Assumes each vector's metadata contains "abstract" (or "text"), "title", and "url"
            //    fields — adjust field names to match however you indexed your abstracts.
            var chunks = queryResponse.Matches
                .Select(match =>
                {
                    var metadata = match.Metadata;

                    var text = metadata != null && metadata.TryGetValue("abstract", out var abstractVal)
                        ? abstractVal?.ToString() ?? string.Empty
                        : string.Empty;

                    var title = metadata != null && metadata.TryGetValue("title", out var titleVal)
                        ? titleVal?.ToString()
                        : null;

                    var url = metadata != null && metadata.TryGetValue("url", out var urlVal)
                        ? urlVal?.ToString()
                        : null;
                    var authors = metadata != null && metadata.TryGetValue("authors", out var authorsVal)
                        ? authorsVal?.ToString()
                        : null;
                    var publicationYear = metadata != null && metadata.TryGetValue("publication_year", out var publicationYearVal)
                        ? publicationYearVal?.ToString()
                        : null;
                    var journal = metadata != null && metadata.TryGetValue("journal", out var journalVal)
                        ? journalVal?.ToString()
                        : null;
                    var relevanceScore = metadata != null && metadata.TryGetValue("relevance_score", out var relevanceScoreVal)
                        ? relevanceScoreVal?.ToString()
                        : null;

                    return new Chunk(text, title, url, authors, publicationYear, journal, relevanceScore);
                })
                .Where(c => !string.IsNullOrWhiteSpace(c.Text)) // drop any malformed/empty entries
                .ToList();

            _logger.LogInformation(
                "Pinecone returned {Count} relevant chunks for query: {Query}",
                chunks.Count, query);

            return chunks;
        }

        public async Task<bool> UpsertAbstractAsync(string id, Chunk chunk)
        {
            if (string.IsNullOrEmpty(chunk.Text))
            {
                _logger.LogWarning("Cannot Upsert chunk {Id}: Text content is empty.", id);
                return false;
            }

            try
            {
                OpenAIEmbedding embeddingResult = await _embeddingClient.GenerateEmbeddingAsync(chunk.Text);
                float[] vectorValues = embeddingResult.ToFloats().ToArray();

                var metadata = new Metadata();
                metadata["abstract"] = chunk.Text;

                if (!string.IsNullOrEmpty(chunk.Title)) metadata["title"] = chunk.Title;
                if (!string.IsNullOrEmpty(chunk.Url)) metadata["url"] = chunk.Url;
                if (!string.IsNullOrEmpty(chunk.Authors)) metadata["authors"] = chunk.Authors;
                if (!string.IsNullOrEmpty(chunk.PublicationYear)) metadata["publication_year"] = chunk.PublicationYear;
                if (!string.IsNullOrEmpty(chunk.Journal)) metadata["journal"] = chunk.Journal;

                var vector = new Vector
                {
                    Id = id,
                    Values = vectorValues,
                    Metadata = metadata
                };

                var index = _pineconeClient.Index(IndexName);
                await index.UpsertAsync(new UpsertRequest
                {
                    Vectors = new[] { vector }
                });

                _logger.LogInformation("Successfully Upserted abstract chunk {Id} into Pinecone index {Index}", id, IndexName);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to upsert abstract chunk {Id} in to Pinecone index {Index}", id, IndexName);
                return false;
            }

        }
        
    }
}