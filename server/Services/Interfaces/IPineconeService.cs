using server.Models.Retrieval;

// server/Services/Interfaces/IPineconeService.cs
//
// The vector-store boundary of MonteAI. Everything above this interface
// (agent tools, ingestion, chat) is unaware of Pinecone specifics.
//
// Ingestion is METADATA-ONLY: exactly ONE vector per thesis
// (thesis_{id}_meta in the metadata namespace, carrying title/author/year/
// abstract). There are no body/full-text chunks.

namespace server.Services.Interfaces
{
    public interface IPineconeService
    {
        /// <summary>
        /// Embeds the query (text-embedding-3-small) and retrieves the most
        /// similar thesis METADATA vectors from Pinecone, applying any
        /// <paramref name="options"/> filters and the configured score
        /// threshold. Irrelevant chunks never leave this method.
        /// </summary>
        Task<List<Chunk>> RetrieveRelevantChunksAsync(
            string query,
            RetrievalOptions? options = null,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Embeds and upserts the single metadata vector for a thesis
        /// (id: thesis_{id}_meta). Upserting the same id again REPLACES the
        /// previous metadata vector, which is how re-ingestion refreshes
        /// title/author/year/abstract. Returns the number of vectors
        /// upserted (0 or 1).
        /// </summary>
        Task<int> UpsertMetadataChunkAsync(
            Guid thesisId,
            Chunk metadataChunk,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Removes every vector belonging to a thesis (by thesis_id metadata
        /// filter, by the legacy thesis_{id}_chunk_* ID prefix, and by the
        /// deterministic metadata-vector id). Called before re-ingestion and
        /// on thesis deletion so the knowledge base never serves stale data.
        /// Also sweeps legacy full-text chunks left in the pre-split default
        /// namespace. Returns the number of vectors removed by ID.
        /// </summary>
        Task<int> DeleteThesisVectorsAsync(Guid thesisId, CancellationToken cancellationToken = default);
    }
}
