// server/Models/Retrieval/RetrievalOptions.cs
//
// Optional filters applied at Pinecone query time. Passed by the agent's
// semantic_search tool (or by any future caller) so retrieval can be narrowed
// to a specific thesis or year range instead of always scanning the whole index.

namespace server.Models.Retrieval
{
    public record RetrievalOptions
    {
        /// <summary>Number of chunks to fetch. Falls back to PineconeConfig.TopK when null.</summary>
        public int? TopK { get; init; }

        /// <summary>Minimum similarity score. Falls back to PineconeConfig.ScoreThreshold when null.</summary>
        public double? ScoreThreshold { get; init; }

        /// <summary>Restrict retrieval to chunks of a single thesis (used for re-checking / metadata lookups).</summary>
        public string? ThesisId { get; init; }

        /// <summary>Earliest publication year (inclusive), matched against the publication_year metadata field.</summary>
        public int? YearFrom { get; init; }

        /// <summary>Latest publication year (inclusive), matched against the publication_year metadata field.</summary>
        public int? YearTo { get; init; }
    }
}
