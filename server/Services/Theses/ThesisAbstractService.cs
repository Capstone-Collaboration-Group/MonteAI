using Google.Cloud.Firestore;
using server.Models.DTOs.Thesis;
using server.Services.Interfaces;

namespace server.Services.Theses
{
    // server/Services/Theses/ThesisAbstractService.cs
    //
    // Firestore layout: collection "thesis_abstracts" → one document per thesis
    // (doc id = thesis Guid) → map field "abstracts" keyed by version number
    // as a string: { "1": "text", "2": "revised text", ... }.
    public class ThesisAbstractService : IThesisAbstractService
    {
        private const string CollectionName = "thesis_abstracts";
        private const string AbstractsField = "abstracts";

        private readonly FirestoreDb _firestore;
        private readonly ILogger<ThesisAbstractService> _logger;

        public ThesisAbstractService(FirestoreDb firestore, ILogger<ThesisAbstractService> logger)
        {
            _firestore = firestore;
            _logger = logger;
        }

        private DocumentReference DocRef(Guid thesisId)
            => _firestore.Collection(CollectionName).Document(thesisId.ToString());

        public async Task SetAbstractAsync(Guid thesisId, int versionNumber, string text)
        {
            // Merge into the nested map key — creates the document when missing
            // and leaves sibling version entries intact.
            await DocRef(thesisId).SetAsync(
                new Dictionary<string, object> { [Key(versionNumber)] = text },
                SetOptions.MergeAll);

            _logger.LogInformation(
                "Abstract stored for thesis {ThesisId} version {Version}", thesisId, versionNumber);
        }

        public async Task<string?> GetLatestAsync(Guid thesisId)
        {
            var snapshot = await DocRef(thesisId).GetSnapshotAsync();
            if (!snapshot.Exists || !snapshot.ContainsField(AbstractsField)) return null;

            var map = snapshot.GetValue<Dictionary<string, object>>(AbstractsField);

            string? text = null;
            int bestVersion = int.MinValue;

            foreach (var entry in map)
            {
                if (!int.TryParse(entry.Key, out var version)) continue;
                if (version > bestVersion)
                {
                    bestVersion = version;
                    text = entry.Value?.ToString();
                }
            }

            return text;
        }

        public async Task RemoveVersionAsync(Guid thesisId, int versionNumber)
        {
            var doc = DocRef(thesisId);
            var snapshot = await doc.GetSnapshotAsync();
            if (!snapshot.Exists || !snapshot.ContainsField(AbstractsField)) return;

            await doc.UpdateAsync(new Dictionary<string, object>
            {
                [Key(versionNumber)] = FieldValue.Delete
            });

            _logger.LogInformation(
                "Abstract entry removed for thesis {ThesisId} version {Version}", thesisId, versionNumber);
        }

        public async Task DeleteThesisAsync(Guid thesisId)
        {
            await DocRef(thesisId).DeleteAsync();
            _logger.LogInformation("Abstract document deleted for thesis {ThesisId}", thesisId);
        }

        public async Task ResolveAbstractsAsync(IEnumerable<ThesisResponseDto> dtos)
        {
            // Only values shaped like a GUID can be document IDs; legacy rows
            // hold raw text and are returned as-is.
            var candidates = dtos.Where(d => Guid.TryParse(d.Abstract, out _)).ToList();
            if (candidates.Count == 0) return;

            // Parallel — the list endpoint resolves up to 20 documents.
            await Task.WhenAll(candidates.Select(async dto =>
            {
                try
                {
                    dto.Abstract = await GetLatestAsync(dto.Id);
                }
                catch (Exception ex)
                {
                    // Degrade to null rather than leaking the doc ID to clients
                    // or failing the whole response over one Firestore hiccup.
                    _logger.LogWarning(ex, "Could not resolve abstract for thesis {ThesisId}", dto.Id);
                    dto.Abstract = null;
                }
            }));
        }

        // Firestore map key for a version ("abstracts.<n>" field path).
        private static string Key(int versionNumber) => $"{AbstractsField}.{versionNumber}";
    }
}
