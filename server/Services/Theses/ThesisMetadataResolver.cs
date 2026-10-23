// server/Services/Theses/ThesisMetadataResolver.cs
//
// The single authority for "who wrote this thesis and when" — used twice:
//
//   INGEST (ThesisService.IngestAsync): the server-side metadata resolution
//   replaces the old desktop title-page extraction, so the one metadata
//   vector per thesis always lands with authors + year already embedded
//   ("Authors: …" header) and stored (metadata["authors"] /
//   ["publication_year"]).
//
//   READ (AgentToolbox, MonteAiAgentService, DeterministicResponder): fills
//   citations whose vectors predate that fix, so the synthesizer gets
//   "Author(s): Dela Cruz | Year: 2024" instead of "Unknown | n.d." and can
//   write "According to Dela Cruz et al. (2024)… [Source 1]" as the prompt
//   already instructs.
//
// Scoped with a per-request source memo: enriching several citations for the
// same thesis (or the toolbox + the final merged list) hits SQL/Firestore
// once. Failures degrade to null — retrieval must never break over metadata.

using server.Models.DTOs.ChatMessage;
using server.Models.Retrieval;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

namespace server.Services.Theses
{
    public class ThesisMetadataResolver : IThesisMetadataResolver
    {
        // Bound on distinct thesis lookups per EnrichAsync call — retrieval
        // can return 100 chunks across two namespaces; the tail matches are
        // rarely cited, so resolving the strongest ids is enough.
        private const int MaxResolvePerCall = 15;

        private readonly IThesisRepository _thesisRepo;
        private readonly IThesisAbstractService _abstractService;
        private readonly ILogger<ThesisMetadataResolver> _logger;

        // Source lookups (SQL + Firestore) memoized for this scope. Keyed by
        // thesis id only — preferred values are applied AFTER the cache, so
        // ingest-time and read-time calls share entries safely.
        private readonly Dictionary<Guid, SourceMetadata> _sourceCache = new();

        public ThesisMetadataResolver(
            IThesisRepository thesisRepo,
            IThesisAbstractService abstractService,
            ILogger<ThesisMetadataResolver> logger)
        {
            _thesisRepo = thesisRepo;
            _abstractService = abstractService;
            _logger = logger;
        }

        // Everything the stores know, independent of any caller preference.
        private sealed record SourceMetadata(
            string? FirestoreAuthors,
            string? FirestoreYear,
            string? GroupAuthors,
            string? SubmittedYear);

        public async Task<ResolvedThesisMetadata> ResolveAsync(
            Guid thesisId,
            string? preferredAuthors = null,
            string? preferredPublicationYear = null,
            CancellationToken cancellationToken = default)
        {
            var preferred = NotEmpty(preferredAuthors);
            var preferredYear = NotEmpty(preferredPublicationYear);

            // Fast path: both supplied (e.g. admin archival chunks) — no I/O.
            if (preferred is not null && preferredYear is not null)
                return new ResolvedThesisMetadata(preferred, preferredYear);

            var source = await GetSourcesAsync(thesisId, cancellationToken);

            return new ResolvedThesisMetadata(
                preferred ?? source.FirestoreAuthors ?? source.GroupAuthors,
                preferredYear ?? source.FirestoreYear ?? source.SubmittedYear);
        }

        public async Task EnrichAsync(List<Chunk> chunks, CancellationToken cancellationToken = default)
        {
            if (chunks.Count == 0) return;

            foreach (var id in MissingIds(chunks.Select(c => (c.ThesisId, Needs(c.Authors, c.PublicationYear)))))
            {
                var resolved = await ResolveAsync(id, cancellationToken: cancellationToken);

                for (var i = 0; i < chunks.Count; i++)
                {
                    var chunk = chunks[i];
                    if (!string.Equals(chunk.ThesisId, id.ToString(), StringComparison.Ordinal)) continue;

                    chunks[i] = chunk with
                    {
                        Authors = NotEmpty(chunk.Authors) ?? resolved.Authors,
                        PublicationYear = NotEmpty(chunk.PublicationYear) ?? resolved.PublicationYear,
                    };
                }
            }
        }

        public async Task EnrichAsync(List<ChatSourceDto> sources, CancellationToken cancellationToken = default)
        {
            if (sources.Count == 0) return;

            foreach (var id in MissingIds(sources.Select(s => (s.ThesisId, Needs(s.Authors, s.PublicationYear)))))
            {
                var resolved = await ResolveAsync(id, cancellationToken: cancellationToken);

                foreach (var source in sources)
                {
                    if (!string.Equals(source.ThesisId, id.ToString(), StringComparison.Ordinal)) continue;

                    source.Authors = NotEmpty(source.Authors) ?? resolved.Authors;
                    source.PublicationYear = NotEmpty(source.PublicationYear) ?? resolved.PublicationYear;
                }
            }
        }

        /// <summary>
        /// Distinct parseable thesis ids that still need at least one field,
        /// first occurrence (score order) first, capped per call.
        /// </summary>
        private static IEnumerable<Guid> MissingIds(
            IEnumerable<(string? ThesisId, bool NeedsMore)> rows)
        {
            var seen = new HashSet<Guid>();
            var emitted = 0;
            foreach (var (thesisId, needsMore) in rows)
            {
                if (!needsMore) continue;
                if (thesisId is null || !Guid.TryParse(thesisId, out var id)) continue;
                if (!seen.Add(id)) continue;
                if (emitted++ >= MaxResolvePerCall) yield break;
                yield return id;
            }
        }

        private async Task<SourceMetadata> GetSourcesAsync(Guid thesisId, CancellationToken cancellationToken)
        {
            if (_sourceCache.TryGetValue(thesisId, out var cached)) return cached;

            string? groupAuthors = null;
            string? submittedYear = null;
            try
            {
                // Includes ResearchGroup + Leader + Students — the catalog's
                // author source for student theses.
                var thesis = await _thesisRepo.GetThesisByIdAsync(thesisId);
                if (thesis is not null)
                {
                    groupAuthors = ThesisAuthorNames.Join(
                        ThesisAuthorNames.FromResearchGroup(thesis.ResearchGroup));
                    submittedYear = thesis.SubmittedAt?.Year.ToString();
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "SQL author resolution failed for thesis {ThesisId}", thesisId);
            }

            string? firestoreAuthors = null;
            string? firestoreYear = null;
            try
            {
                var stored = await _abstractService.GetStoredMetadataAsync(thesisId);
                if (stored is not null)
                {
                    firestoreAuthors = ThesisAuthorNames.Join(stored.Authors);
                    firestoreYear = stored.PublicationYear;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Firestore author resolution failed for thesis {ThesisId}", thesisId);
            }

            var source = new SourceMetadata(firestoreAuthors, firestoreYear, groupAuthors, submittedYear);
            _sourceCache[thesisId] = source;
            return source;
        }

        private static bool Needs(string? authors, string? year)
            => string.IsNullOrWhiteSpace(authors) || string.IsNullOrWhiteSpace(year);

        private static string? NotEmpty(string? value)
            => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
