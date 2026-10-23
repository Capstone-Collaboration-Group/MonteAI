// server/Models/Retrieval/Chunk.cs
//
// The unit of retrieved knowledge in MonteAI.
//
// Lifecycle of a Chunk:
//   1. SERVER (ThesisService.IngestAsync): BuildMetadataChunk produces this
//      record (Title/Authors/Year/Abstract block), then PineconeService
//      embeds the Text and upserts it together with the metadata fields
//      below — one per thesis (thesis_{id}_meta).
//   2. QUERY TIME (PineconeService.RetrieveRelevantChunksAsync): Pinecone matches
//      are mapped BACK into this record, so the agent tools and prompt builder
//      work with one shape regardless of where the data came from.
//   3. ANSWER TIME (MonteAiAgentService): chunks are converted into
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
