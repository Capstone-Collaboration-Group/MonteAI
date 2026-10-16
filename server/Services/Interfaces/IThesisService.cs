using server.Infrastructure;
using server.Models.DTOs.Thesis;
using server.Models.Entities;

namespace server.Services.Interfaces
{
    public interface IThesisService
    {
        /// <param name="program">Optional academic-program filter (ICS / IBE /
        /// ITE) forwarded to the repository. Null / unknown returns unfiltered.</param>
        Task<IEnumerable<ThesisResponseDto>> GetFirst20ThesisAsync(
            string? program = null,
            string? studentId = null);
        Task<IReadOnlyList<ThesisResponseDto>> SearchAsync(
            string query,
            bool semantic,
            string? studentId,
            CancellationToken cancellationToken = default);

        Task<ThesisResponseDto?> GetByIdAsync(Guid id);

        /// <summary>
        /// The thesis submitted by the caller's research group — powers the
        /// /submit page. Null when the caller isn't a student, has no group,
        /// or the group hasn't submitted yet (client renders its empty state).
        /// </summary>
        Task<ThesisResponseDto?> GetMyThesisAsync(string callerId);

        Task<ThesisResponseDto> SubmitAsync(SubmitThesisDto submitDto, string uploaderId, bool isAdmin = false);

        Task<IngestThesisResponseDto> IngestAsync(IngestThesisDto dto);

        /// <summary>
        /// Phase 1 of async full-text ingestion (POST /thesis/ingest/full):
        /// stages the extracted text to blob storage, upserts the single
        /// metadata vector so the thesis is citable immediately, marks the row
        /// Approved/Indexing, and enqueues the body job for the background
        /// worker. Returns "Queued" or "Failed".
        /// </summary>
        Task<IngestFullThesisResponseDto> IngestFullAsync(IngestFullThesisDto dto);

        /// <summary>
        /// Phase 2 (background worker): chunks the staged full text, wipes old
        /// BODY vectors only (the metadata vector survives), batch-upserts the
        /// body chunks, and marks the thesis Indexed. Throws on failure so the
        /// worker can retry.
        /// </summary>
        Task ProcessQueuedIngestionAsync(ThesisIngestionJob job, CancellationToken cancellationToken = default);

        Task<string?> GetDownloadUrlAsync(Guid thesisId);
        Task<bool> UpdateDetailsAsync(Guid id, UpdateThesisDto updateThesisdto, string callerId, bool isAdmin);

        Task<bool> UpdateStatusAsync(Guid id, UpdateThesisStatusDto updateStatusDto);

        Task<bool> DeleteAsync(Guid id);

        // ThesisVersion services

        Task<IEnumerable<ThesisVersionResponseDto>> GetByVersionsAsync(Guid thesisId);

        Task<ThesisVersionResponseDto?> GetByVersionIdAsync(Guid versionId);

        Task<ThesisVersionResponseDto?> GetLatestThesisIdAsync(Guid thesisId);

        Task<int> GetNextVersionNumber(Guid thesisId);

        Task<bool> CreateThesisVersion(CreateThesisVersionDto thesisVersionDto, string uploadedById);

        Task<bool> DeleteThesisVersion(Guid thesisId, string callerId, bool isAdmin);

        /// <summary>
        /// Deletes ONE version of a thesis. Only the LATEST version may be
        /// deleted (flow 3→2→1); deleting the final remaining version removes
        /// the whole thesis (SQL row, blobs, vectors, abstract doc, annotations).
        /// Throws UnauthorizedAccessException (not group leader),
        /// KeyNotFoundException (unknown thesis/version), or
        /// InvalidOperationException (version is not the latest).
        /// </summary>
        Task<bool> DeleteThesisVersionById(Guid thesisId, Guid versionId, string callerId, bool isAdmin);


    }
}
