using server.Models.Retrieval;

// server/Services/Interfaces/IPineconeService.cs
//
// The vector-store boundary of MonteAI. Everything above this interface
// (agent tools, ingestion, chat) is unaware of Pinecone specifics.

namespace server.Services.Interfaces
{
    public interface IPineconeService
    {
        /// <summary>
        /// Embeds the query (text-embedding-3-small) and retrieves the most
        /// similar thesis abstract chunks from Pinecone, applying any
        /// <paramref name="options"/> filters and the configured score
        /// threshold. Irrelevant chunks never leave this method.
        /// </summary>
        Task<List<Chunk>> RetrieveRelevantChunksAsync(
            string query,
            RetrievalOptions? options = null,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Embeds and upserts a batch of chunks for one thesis. Embeddings are
        /// generated in batches (16 per Azure OpenAI call) and vectors are
        /// upserted in bulk — instead of one HTTP round-trip per chunk.
        /// Returns the number of vectors actually upserted.
        /// </summary>
        Task<int> UpsertAbstractsAsync(
            Guid thesisId,
            IReadOnlyList<Chunk> chunks,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Embeds and upserts the single metadata vector for a thesis
        /// (id: thesis_{id}_meta). Upserting the same id again REPLACES the
        /// previous metadata vector, which is how catalog edits refresh
        /// title/author/year without touching the body chunks.
        /// Returns the number of vectors upserted (0 or 1).
        /// </summary>
        Task<int> UpsertMetadataChunkAsync(
            Guid thesisId,
            Chunk metadataChunk,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Removes every vector belonging to a thesis (by ID prefix and by
        /// thesis_id metadata filter). Called before re-ingestion and on
        /// thesis deletion so the knowledge base never serves stale data.
        /// Returns the number of vectors removed by ID.
        /// </summary>
        Task<int> DeleteThesisVectorsAsync(Guid thesisId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Removes only the BODY vectors of a thesis (the
        /// thesis_{id}_chunk_* prefix) — the metadata vector
        /// (thesis_{id}_meta) survives. Used by the async full-text pipeline
        /// so a body re-ingest never wipes the already-citable metadata
        /// chunk. Returns the number of vectors removed by ID.
        /// </summary>
        Task<int> DeleteBodyVectorsAsync(Guid thesisId, CancellationToken cancellationToken = default);
    }
}
