using server.Models.DTOs.Thesis;

namespace server.Services.Interfaces
{
    /// <summary>
    /// Per-version abstract texts stored in Firestore
    /// (collection: thesis_abstracts, one document per thesis, id = thesis Guid,
    /// map field "abstracts" keyed by version number as a string).
    ///
    /// The SQL Theses.Abstract column only stores the Firestore document ID —
    /// legacy rows still hold raw text, which readers pass through unchanged
    /// (non-GUID values are treated as text).
    /// </summary>
    public interface IThesisAbstractService
    {
        /// <summary>
        /// Create or overwrite the abstract text for one version. Admin
        /// archival uploads also pass the metadata that lives beside the
        /// abstract in the same document ("authors" array + "publicationYear"
        /// string) — both are merged in one Firestore write.
        /// </summary>
        Task SetAbstractAsync(
            Guid thesisId,
            int versionNumber,
            string text,
            IReadOnlyList<string>? authors = null,
            string? publicationYear = null);

        /// <summary>Abstract text of the highest stored version, or null if none.</summary>
        Task<string?> GetLatestAsync(Guid thesisId);

        /// <summary>
        /// Catalog edit (PUT /thesis/update/details): replace the LATEST
        /// version's abstract text IN PLACE. Overwriting the same version key
        /// keeps the map aligned with ThesisVersion rows — a later revision
        /// still supersedes the edit via SetAbstractAsync(VersionNumber).
        /// </summary>
        Task UpdateAbstractAsync(Guid thesisId, string text);

        /// <summary>Drop one version's entry (used when a version is deleted).</summary>
        Task RemoveVersionAsync(Guid thesisId, int versionNumber);

        /// <summary>Delete the thesis's whole abstract document.</summary>
        Task DeleteThesisAsync(Guid thesisId);

        /// <summary>
        /// In-place: replace DTO.Abstract (Firestore doc ID) with the resolved
        /// text, and DTO.Authors / DTO.PublicationYear with the stored
        /// metadata when present (admin archival uploads). Rows whose column
        /// holds raw text are left untouched. Resolution failures degrade to
        /// null instead of failing the whole response.
        /// </summary>
        Task ResolveAbstractsAsync(IEnumerable<ThesisResponseDto> dtos);
    }
}
