// server/Configuration/PineconeConfig.cs
//
// Configuration for the Pinecone vector store and the Azure OpenAI embedding
// calls made alongside it.
//
// Ingestion is METADATA-ONLY: one vector per thesis (id thesis_{id}_meta in
// MetadataNamespace, carrying title/author/year/abstract). There is no
// full-text/body chunking and no second namespace.
//
// Bound from the "Pinecone" section of appsettings*.json. The ApiKey itself
// only ever lives in the gitignored appsettings.Development.json / production
// secrets — never in this committed file.

namespace server.Configuration
{
    public class PineconeConfig
    {
        public const string SectionName = "Pinecone";

        public string ApiKey { get; set; } = string.Empty;

        /// <summary>Vector index that stores one metadata vector per thesis.</summary>
        public string IndexName { get; set; } = "research-assistant-abstracts";

        /// <summary>
        /// Namespace holding ONE metadata vector per thesis (id
        /// thesis_{id}_meta, the abstract/title/author block). "__default__"
        /// is Pinecone's built-in namespace.
        /// </summary>
        public string MetadataNamespace { get; set; } = "__default__";

        public string Host { get; set; } = string.Empty;

        /// <summary>
        /// Default number of vectors fetched per semantic query. Default: 10.
        /// </summary>
        public int TopK { get; set; } = 10;

        /// <summary>
        /// Minimum cosine similarity for a vector to be considered relevant.
        /// Vectors scoring below this are discarded BEFORE they reach the LLM,
        /// which both saves tokens and reduces hallucinations. Measured on
        /// text-embedding-3-small over this corpus: metadata-only (abstract
        /// level) similarity tops out ~0.26-0.34 for relevant matches, so the
        /// old 0.30 rejected every query after the revert — 0.2 keeps the
        /// top of the list while still cutting the tail. Default: 0.20.
        /// </summary>
        public double ScoreThreshold { get; set; } = 0.20;

        /// <summary>
        /// Relative cutoff applied AFTER ScoreThreshold: a match scoring more
        /// than this below the BEST match of the same query is dropped. The
        /// absolute threshold alone cannot tell "one exact-title hit plus four
        /// off-topic neighbours" (scores ~0.45 vs ~0.26) from a uniformly
        /// relevant list, so unrelated theses still reached the prompt and the
        /// sources panel. Relevant matches cluster within ~0.08 of each other,
        /// so a wider margin would start cutting real hits. Set to 0 to
        /// disable. Default: 0.08.
        /// </summary>
        public double RelativeScoreMargin { get; set; } = 0.08;
    }
}
