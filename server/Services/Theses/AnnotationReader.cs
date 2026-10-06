using Google.Cloud.Firestore;
using server.Models.DTOs.Thesis;
using server.Services.Interfaces;

namespace server.Services.Theses
{
    // server/Services/Theses/AnnotationReader.cs
    //
    // Firestore layout (mirrors packages/api/src/annotation/liveAnnotationService.ts):
    // theses/{thesisId}/versions/{versionId}/annotations — one document per
    // panelist comment: { reviewerId (Firebase UID), comment, pageNumber,
    // isResolved, resolverNote, createdAt }.
    public class AnnotationReader : IAnnotationReader
    {
        private const string RootCollection = "theses";
        private const string VersionsCollection = "versions";
        private const string AnnotationsCollection = "annotations";

        private readonly FirestoreDb _firestore;
        private readonly ILogger<AnnotationReader> _logger;

        public AnnotationReader(FirestoreDb firestore, ILogger<AnnotationReader> logger)
        {
            _firestore = firestore;
            _logger = logger;
        }

        public async Task<IReadOnlyList<ProceedingsAnnotationDto>> ReadAsync(
            Guid thesisId,
            IReadOnlyList<Guid> versionIds)
        {
            var rows = new List<ProceedingsAnnotationDto>();
            if (versionIds.Count == 0) return rows;

            var thesisDoc = _firestore.Collection(RootCollection).Document(thesisId.ToString());

            var tasks = versionIds.Select(async versionId =>
            {
                try
                {
                    var snapshot = await thesisDoc
                        .Collection(VersionsCollection)
                        .Document(versionId.ToString())
                        .Collection(AnnotationsCollection)
                        .OrderBy("createdAt")
                        .GetSnapshotAsync();

                    return snapshot.Documents.Select(ToDto).ToList();
                }
                catch (Exception ex)
                {
                    // Degrade to "no comments" rather than failing the whole PDF
                    // over one Firestore hiccup.
                    _logger.LogWarning(
                        ex,
                        "Could not read annotations for thesis {ThesisId} version {VersionId}",
                        thesisId, versionId);
                    return new List<ProceedingsAnnotationDto>();
                }
            }).ToList();

            foreach (var batch in await Task.WhenAll(tasks))
                rows.AddRange(batch);

            return rows
                .OrderBy(r => r.CreatedAt, StringComparer.Ordinal)
                .ThenBy(r => r.ReviewerId, StringComparer.Ordinal)
                .ToList();
        }

        private static ProceedingsAnnotationDto ToDto(DocumentSnapshot doc)
        {
            var data = doc.ToDictionary() ?? new Dictionary<string, object>();

            return new ProceedingsAnnotationDto
            {
                ReviewerId = ReadString(data, "reviewerId"),
                Comment = ReadString(data, "comment"),
                IsResolved = data.TryGetValue("isResolved", out var resolved) && resolved is true,
                ResolverNote = ReadString(data, "resolverNote") is { Length: > 0 } note ? note : null,
                PageNumber = data.TryGetValue("pageNumber", out var page) ? page switch
                {
                    long l => (int)l,
                    int i => i,
                    double d => (int)d,
                    _ => 1,
                } : 1,
                CreatedAt = ReadString(data, "createdAt"),
            };
        }

        private static string ReadString(IReadOnlyDictionary<string, object> data, string key)
            => data.TryGetValue(key, out var value) && value != null
                ? value.ToString() ?? string.Empty
                : string.Empty;
    }
}
