// server/Configuration/PineconeConfig.cs
//
// Configuration for the Pinecone vector store and the Azure OpenAI embedding
// calls made alongside it.
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

        /// <summary>Vector index that stores thesis abstract chunks.</summary>
        public string IndexName { get; set; } = "research-assistant-abstracts";

        public string Host { get; set; } = string.Empty;

        /// <summary>Default number of chunks fetched per semantic query. Default: 5.</summary>
        public int TopK { get; set; } = 5;

        /// <summary>
        /// Minimum cosine similarity for a chunk to be considered relevant.
        /// Chunks scoring below this are discarded BEFORE they reach the LLM,
        /// which both saves tokens and reduces hallucinations. Default: 0.25.
        /// </summary>
        public double ScoreThreshold { get; set; } = 0.25;

        /// <summary>
        /// Number of texts sent per Azure OpenAI embedding request
        /// (text-embedding-3-small accepts up to 16 inputs per call — batching
        /// keeps ingestion cheap instead of one HTTP call per chunk). Default: 16.
        /// </summary>
        public int EmbeddingBatchSize { get; set; } = 16;

        /// <summary>Maximum vectors sent per Pinecone upsert request. Default: 100.</summary>
        public int MaxUpsertBatchSize { get; set; } = 100;

        /// <summary>
        /// Safety cap on chunks accepted per thesis ingestion request, so a
        /// malformed desktop payload cannot fan out into a huge embedding
        /// bill. Default: 64.
        /// </summary>
        public int MaxChunksPerIngest { get; set; } = 64;
    }
}
