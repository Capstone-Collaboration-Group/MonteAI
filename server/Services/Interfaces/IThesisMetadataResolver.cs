// server/Services/Interfaces/IThesisMetadataResolver.cs
//
// One precedence order for a thesis' citation identity (authors + publication
// year), shared by INGEST time (vectors embed and store the names) and READ
// time (already-indexed vectors cite correctly without a reindex).

using server.Models.DTOs.ChatMessage;
using server.Models.Retrieval;

namespace server.Services.Interfaces
{
    public interface IThesisMetadataResolver
    {
        /// <summary>
        /// Resolves authors + publication year for a thesis:
        ///   preferred value (fresh title-page extraction / queued job)
        ///   → Firestore stored metadata (admin archival / submit-form fields)
        ///   → research-group members (student theses — the catalog's authors)
        ///   → SubmittedAt year (year only — the stand-in keyword_search uses)
        /// Source lookups are memoized per scoped instance; never throws.
        /// </summary>
        Task<ResolvedThesisMetadata> ResolveAsync(
            Guid thesisId,
            string? preferredAuthors = null,
            string? preferredPublicationYear = null,
            CancellationToken cancellationToken = default);

        /// <summary>Fills only the missing Authors/PublicationYear of retrieved chunks.</summary>
        Task EnrichAsync(List<Chunk> chunks, CancellationToken cancellationToken = default);

        /// <summary>Fills only the missing Authors/PublicationYear of built citations.</summary>
        Task EnrichAsync(List<ChatSourceDto> sources, CancellationToken cancellationToken = default);
    }

    /// <summary>Joined display values, ready for vector metadata / prompts. Null = genuinely unknown.</summary>
    public sealed record ResolvedThesisMetadata(string? Authors, string? PublicationYear);
}
