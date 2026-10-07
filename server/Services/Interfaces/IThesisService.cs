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

        Task<ThesisResponseDto?> GetByIdAsync(Guid id);

        /// <summary>
        /// The thesis submitted by the caller's research group — powers the
        /// /submit page. Null when the caller isn't a student, has no group,
        /// or the group hasn't submitted yet (client renders its empty state).
        /// </summary>
        Task<ThesisResponseDto?> GetMyThesisAsync(string callerId);

        Task<ThesisResponseDto> SubmitAsync(SubmitThesisDto submitDto, string uploaderId, bool isAdmin = false);

        Task<IngestThesisResponseDto> IngestAsync(IngestThesisDto dto);
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
