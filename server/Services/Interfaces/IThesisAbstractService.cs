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
        /// <summary>Create or overwrite the abstract text for one version.</summary>
        Task SetAbstractAsync(Guid thesisId, int versionNumber, string text);

        /// <summary>Abstract text of the highest stored version, or null if none.</summary>
        Task<string?> GetLatestAsync(Guid thesisId);

        /// <summary>Drop one version's entry (used when a version is deleted).</summary>
        Task RemoveVersionAsync(Guid thesisId, int versionNumber);

        /// <summary>Delete the thesis's whole abstract document.</summary>
        Task DeleteThesisAsync(Guid thesisId);

        /// <summary>
        /// In-place: replace DTO.Abstract (Firestore doc ID) with the resolved
        /// text. Rows whose column holds raw text are left untouched. Resolution
        /// failures degrade to null instead of failing the whole response.
        /// </summary>
        Task ResolveAbstractsAsync(IEnumerable<ThesisResponseDto> dtos);
    }
}
