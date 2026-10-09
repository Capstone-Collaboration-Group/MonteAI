using server.Models.DTOs.Thesis;

namespace server.Services.Interfaces
{
    public interface IAnnotationReader
    {
        /// <summary>
        /// Annotations for the requested thesis versions, oldest first.
        /// Throws <see cref="server.Services.Theses.AnnotationReadException"/> if any Firestore read fails.
        /// </summary>
        Task<IReadOnlyList<ProceedingsAnnotationDto>> ReadAsync(
            Guid thesisId,
            IReadOnlyList<Guid> versionIds,
            CancellationToken cancellationToken);
    }
}
