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
    //
    // Admin archival uploads additionally store their metadata in the SAME
    // document (never in the SQL Theses table — the Abstract column keeps
    // holding only this document's ID):
    //     authors:         ["Cruz, Juan", "Santos, Maria"]  (array)
    //     publicationYear: "2019"                            (string)
    public class ThesisAbstractService : IThesisAbstractService
    {
        private const string CollectionName = "thesis_abstracts";
        private const string AbstractsField = "abstracts";
        private const string AuthorsField = "authors";
        private const string PublicationYearField = "publicationYear";

        private readonly FirestoreDb _firestore;
        private readonly ILogger<ThesisAbstractService> _logger;

        public ThesisAbstractService(FirestoreDb firestore, ILogger<ThesisAbstractService> logger)
        {
            _firestore = firestore;
            _logger = logger;
        }

        private DocumentReference DocRef(Guid thesisId)
            => _firestore.Collection(CollectionName).Document(thesisId.ToString());

        public async Task SetAbstractAsync(
            Guid thesisId,
            int versionNumber,
            string text,
            IReadOnlyList<string>? authors = null,
            string? publicationYear = null)
        {
            // Merge into the nested map key — creates the document when missing
            // and leaves sibling version entries intact. Admin uploads add the
            // metadata fields in the SAME write so there is no partial state.
            var payload = new Dictionary<string, object> { [Key(versionNumber)] = text };

            if (authors is { Count: > 0 })
                payload[AuthorsField] = authors.ToList();

            if (!string.IsNullOrWhiteSpace(publicationYear))
                payload[PublicationYearField] = publicationYear.Trim();

            await DocRef(thesisId).SetAsync(payload, SetOptions.MergeAll);

            _logger.LogInformation(
                "Abstract stored for thesis {ThesisId} version {Version}", thesisId, versionNumber);
        }

        public async Task<string?> GetLatestAsync(Guid thesisId)
        {
            var snapshot = await DocRef(thesisId).GetSnapshotAsync();
            if (!snapshot.Exists || !snapshot.ContainsField(AbstractsField)) return null;

            return ReadLatestAbstract(snapshot);
        }

        public async Task UpdateAbstractAsync(Guid thesisId, string text)
        {
            // In-place overwrite of the newest entry: ReadLatestAbstract always
            // takes the highest version key, so replacing it is a pure edit —
            // no new version key is minted (the map stays aligned with the
            // ThesisVersion rows). A missing document is created at version 1.
            var snapshot = await DocRef(thesisId).GetSnapshotAsync();

            var latestKey = 1;
            if (snapshot.Exists && snapshot.ContainsField(AbstractsField))
            {
                var map = snapshot.GetValue<Dictionary<string, object>>(AbstractsField);
                foreach (var entry in map)
                {
                    if (int.TryParse(entry.Key, out var version) && version >= latestKey)
                        latestKey = version;
                }
            }

            await DocRef(thesisId).SetAsync(
                new Dictionary<string, object> { [Key(latestKey)] = text },
                SetOptions.MergeAll);

            _logger.LogInformation(
                "Abstract edited in place for thesis {ThesisId} version {Version}", thesisId, latestKey);
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
                    var snapshot = await DocRef(dto.Id).GetSnapshotAsync();

                    dto.Abstract = snapshot.Exists && snapshot.ContainsField(AbstractsField)
                        ? ReadLatestAbstract(snapshot)
                        : null;

                    // Admin archival metadata — only overwrite the mapped
                    // (research-group) values when Firestore actually has them.
                    // Isolated so a metadata read failure never nulls the
                    // abstract that was already resolved above.
                    try
                    {
                        if (snapshot.Exists && snapshot.ContainsField(AuthorsField))
                        {
                            var authors = ReadAuthors(snapshot.GetValue<object>(AuthorsField));
                            if (authors.Count > 0) dto.Authors = authors;
                        }

                        if (snapshot.Exists && snapshot.ContainsField(PublicationYearField))
                            dto.PublicationYear = snapshot.GetValue<string>(PublicationYearField);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Could not resolve metadata for thesis {ThesisId}", dto.Id);
                    }
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

        // Highest-versioned entry of the "abstracts" map.
        private static string? ReadLatestAbstract(DocumentSnapshot snapshot)
        {
            var map = snapshot.GetValue<Dictionary<string, object>>(AbstractsField);

            string? text = null;
            var bestVersion = int.MinValue;

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

        // Firestore materializes arrays as List<object> (strings inside);
        // accept any non-string IEnumerable so a typed list works too.
        private static List<string> ReadAuthors(object? raw)
        {
            if (raw is null) return [];

            if (raw is string single)
                return string.IsNullOrWhiteSpace(single) ? [] : [single.Trim()];

            return raw is System.Collections.IEnumerable sequence
                ? sequence.Cast<object?>()
                    .Select(value => value?.ToString()?.Trim())
                    .Where(value => !string.IsNullOrWhiteSpace(value))
                    .Select(value => value!)
                    .ToList()
                : [];
        }

        // Firestore map key for a version ("abstracts.<n>" field path).
        private static string Key(int versionNumber) => $"{AbstractsField}.{versionNumber}";
    }
}
