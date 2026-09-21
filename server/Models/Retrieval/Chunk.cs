// server/Models/Retrieval/Chunk.cs
//
// The unit of retrieved knowledge in MonteAI.
//
// Lifecycle of a Chunk:
//   1. DESKTOP: PDF -> abstract isolation -> chunker produces ThesisChunkDto payloads.
//   2. SERVER (ThesisService.IngestAsync): DTOs are mapped to this record, then
//      PineconeService embeds the Text and upserts it together with the metadata
//      fields below.
//   3. QUERY TIME (PineconeService.RetrieveRelevantChunksAsync): Pinecone matches
//      are mapped BACK into this record, so the agent tools and prompt builder
//      work with one shape regardless of where the data came from.
//   4. ANSWER TIME (MonteAiAgentService): chunks are converted into
//      ChatSourceDto citations that travel with the assistant message to the UI.

namespace server.Models.Retrieval
{
    public record Chunk
    (
        string Text,
        string? Title,
        string? Url,
        string? Authors,
        string? PublicationYear,
        string? Journal,
        string? RelevanceScore,
        string? ThesisId = null
    );
}
