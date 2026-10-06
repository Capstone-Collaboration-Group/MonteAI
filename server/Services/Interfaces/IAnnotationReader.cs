using server.Models.DTOs.Thesis;

namespace server.Services.Interfaces
{
    public interface IAnnotationReader
    {
        /// <summary>
        /// Every annotation of every listed thesis version, oldest first.
        /// Degrades to an empty list when Firestore is unreachable so callers
        /// (the proceedings PDF) can still render.
        /// </summary>
        Task<IReadOnlyList<ProceedingsAnnotationDto>> ReadAsync(
            Guid thesisId,
            IReadOnlyList<Guid> versionIds);
    }
}
