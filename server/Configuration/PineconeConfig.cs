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

        /// <summary>
        /// Namespace holding ONE metadata vector per thesis (id
        /// thesis_{id}_meta, the abstract/title/author block). "__default__"
        /// is Pinecone's built-in namespace.
        /// </summary>
        public string MetadataNamespace { get; set; } = "__default__";

        /// <summary>
        /// Namespace holding body chunks (id thesis_{id}_chunk_*) for
        /// full-text RAG. Kept separate from the metadata vector so retrieval
        /// can target each independently.
        /// </summary>
        public string BodyNamespace { get; set; } = "full-text-chunks";

        public string Host { get; set; } = string.Empty;

        /// <summary>
        /// Default number of chunks fetched per semantic query. 10 per
        /// namespace: retrieval keeps only the best chunk per thesis
        /// (MaxPassagesPerThesis=1), so a small topK could collapse to a
        /// single study when one document monopolizes the head of the list.
        /// Default: 10.
        /// </summary>
        public int TopK { get; set; } = 10;

        /// <summary>
        /// Minimum cosine similarity for a chunk to be considered relevant.
        /// Chunks scoring below this are discarded BEFORE they reach the LLM,
        /// which both saves tokens and reduces hallucinations. Measured on
        /// text-embedding-3-small over this corpus: genuinely relevant
        /// matches score ≥ 0.34, off-topic padding sits at 0.19-0.26 — the
        /// old 0.25 let the padding through (e.g. "Student Monitoring" was
        /// returned for "research assistant"). Default: 0.30.
        /// </summary>
        public double ScoreThreshold { get; set; } = 0.30;

        /// <summary>
        /// Number of texts sent per Azure OpenAI embedding request
        /// (text-embedding-3-small accepts up to 16 inputs per call — batching
        /// keeps ingestion cheap instead of one HTTP call per chunk). Default: 16.
        /// </summary>
        public int EmbeddingBatchSize { get; set; } = 16;

        /// <summary>Maximum vectors sent per Pinecone upsert request. Default: 100.</summary>
        public int MaxUpsertBatchSize { get; set; } = 100;

        /// <summary>
        /// Safety cap on chunks accepted per thesis ingestion request. Full-
        /// text ingestion of a ~100-page thesis produces ~50-80 chunks
        /// (512 words each), so the old default of 64 would silently truncate
        /// long documents. Default: 256.
        /// </summary>
        public int MaxChunksPerIngest { get; set; } = 256;

        /// <summary>
        /// Safety cap on the full-text payload accepted by POST
        /// /thesis/ingest/full (characters). ~1M chars ≈ 250k words ≈ a
        /// 600+ page document — far beyond any real thesis. Default: 1_000_000.
        /// </summary>
        public int MaxFullTextChars { get; set; } = 1_000_000;

        /// <summary>
        /// How many thesis body-ingestion jobs the background worker may run
        /// concurrently. Bounded so a burst of approvals cannot stampede the
        /// Azure OpenAI embedding deployment's TPM. Default: 2.
        /// </summary>
        public int MaxConcurrentIngestions { get; set; } = 2;

        /// <summary>
        /// Attempts per queued ingestion job (first try + retries) before the
        /// thesis is marked PineconeStatus=IngestFailed. Default: 3.
        /// </summary>
        public int IngestMaxAttempts { get; set; } = 3;
    }
}
