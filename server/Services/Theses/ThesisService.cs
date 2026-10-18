using AutoMapper;
using Google.Cloud.Firestore;
using Microsoft.Extensions.Options;
using server.Configuration;
using server.Infrastructure;
using server.Models.DTOs.Thesis;
using server.Services.Interfaces;
using ThesisEntity = server.Models.Entities.Thesis;
using server.Repositories;
using server.Repositories.Interfaces;
using server.Models.Retrieval;
using server.Models.Entities;
using System.Text;


// server/Services/Theses/ThesisService.cs
//
// Thesis lifecycle, including the INGESTION hop of the RAG pipeline:
//
//   LEGACY / ADMIN PATH (synchronous, abstract-only):
//   Desktop (Electron)                        Server (this service)
//   ─────────────────                         ─────────────────────
//   approve thesis                          -> IngestAsync(chunks):
//   download PDF via SAS URL                   1. load thesis from SQL (authoritative
//   extract text (first 5 pages)                  Title/FilePath — client-sent URLs are
//   isolate abstract + metadata                   ignored, SAS links expire in minutes)
//   chunk abstract (512 words/50 overlap)      2. cap chunk count (protects embedding bill)
//   POST /thesis/ingest                       3. DELETE old vectors for this thesis
//                                               (idempotent re-ingestion, no stale data)
//                                             4. batch-embed + bulk-upsert to Pinecone
//                                             5. update SQL status/timestamps
//
//   FULL-TEXT ASYNC PATH (desktop student-thesis approvals):
//   Desktop extracts ALL pages + title-page metadata
//     -> POST /thesis/ingest/full
//        IngestFullAsync (sync, fast):
//          1. stage full text to blob (recovery source)
//          2. DELETE all vectors (idempotent)
//          3. upsert ONE metadata vector (thesis_{id}_meta) — citable NOW
//          4. SQL: Status=Approved, PineconeStatus=Indexing
//          5. enqueue body job -> 202 Queued
//        ThesisIngestionWorker (background):
//          ProcessQueuedIngestionAsync: chunk -> delete BODY vectors only ->
//          batch-embed + upsert -> Status=Indexed -> delete staging blob
//
//   Chat query time never touches this service — see MonteAiAgentService.

namespace server.Services.Theses
{
    public class ThesisService : IThesisService
    {
        private readonly IThesisRepository _thesisRepo;
        private readonly IThesisVersionRepository _thesisVersionRepo;
        private readonly IScheduleRepository _scheduleRepository;
        private readonly ILogger<ThesisService> _logger;
        private readonly IMapper _mapper;
        private readonly IPineconeService _pineconeService;
        private readonly IBlobService _blobService;
        private readonly PineconeConfig _pineconeConfig;
        private readonly IStudentRepository _studentRepo;
        private readonly IThesisAbstractService _abstractService;
        private readonly FirestoreDb _firestore;
        private readonly IThesisIngestionQueue _ingestionQueue;
        private readonly IThesisMetadataResolver _metadataResolver;

        public ThesisService(
            IThesisRepository repo,
            IThesisVersionRepository thesisVersionRepo,
            IScheduleRepository scheduleRepository,
            IStudentRepository studentRepo,
            ILogger<ThesisService> logger,
            IMapper mapper,
            IPineconeService pineconeService,
            IBlobService blobService,
            IThesisAbstractService abstractService,
            FirestoreDb firestore,
            IOptions<PineconeConfig> pineconeConfig,
            IThesisIngestionQueue ingestionQueue,
            IThesisMetadataResolver metadataResolver)
        {
            _thesisRepo = repo;
            _thesisVersionRepo = thesisVersionRepo;
            _scheduleRepository = scheduleRepository;
            _studentRepo = studentRepo;
            _logger = logger;
            _mapper = mapper;
            _pineconeService = pineconeService;
            _blobService = blobService;
            _abstractService = abstractService;
            _firestore = firestore;
            _pineconeConfig = pineconeConfig.Value;
            _ingestionQueue = ingestionQueue;
            _metadataResolver = metadataResolver;
        }

        public async Task<IEnumerable<ThesisResponseDto>> GetFirst20ThesisAsync(
            string? program = null,
            string? studentId = null)
        {
            var result = await _thesisRepo.GetFirst20ThesisAsync(program, studentId);

            var dtos = result.Select(MapThesisToResponse).ToList();

            // SQL holds the Firestore doc ID (legacy rows hold raw text) — swap
            // in the actual abstract text before the client ever sees it.
            await _abstractService.ResolveAbstractsAsync(dtos);

            return dtos;

        }

        public async Task<IReadOnlyList<ThesisResponseDto>> SearchAsync(
            string query,
            bool semantic,
            string? studentId,
            CancellationToken cancellationToken = default)
        {
            if (!semantic)
            {
                var exactMatches = await _thesisRepo.SearchCatalogAsync(
                    query, 10, studentId, cancellationToken);
                var exactDtos = exactMatches.Select(MapThesisToResponse).ToList();
                await _abstractService.ResolveAbstractsAsync(exactDtos);
                return exactDtos;
            }

            var chunks = await _pineconeService.RetrieveRelevantChunksAsync(
                query,
                new RetrievalOptions { TopK = 50 },
                cancellationToken);
            var thesisIds = chunks
                .Select(chunk => Guid.TryParse(chunk.ThesisId, out var id) ? id : (Guid?)null)
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .Distinct()
                .Take(10)
                .ToList();
            var matches = await _thesisRepo.GetThesesByIdsAsync(
                thesisIds, studentId, cancellationToken);
            var matchesById = matches.ToDictionary(thesis => thesis.Id);
            var orderedMatches = thesisIds
                .Where(matchesById.ContainsKey)
                .Select(id => matchesById[id])
                .Select(MapThesisToResponse)
                .ToList();

            await _abstractService.ResolveAbstractsAsync(orderedMatches);
            return orderedMatches;
        }

        private ThesisResponseDto MapThesisToResponse(Thesis thesis)
        {
            var dto = _mapper.Map<ThesisResponseDto>(thesis);
            var schedule = thesis.ResearchGroup?.Schedules
                .OrderByDescending(item => item.Date)
                .FirstOrDefault();

            if (schedule is not null)
            {
                dto.GroupId = schedule.GroupId;
                dto.ScheduledAt = schedule.Date.ToDateTime(schedule.StartTime);
                dto.ScheduledVenue = schedule.RoomVenue;
            }

            return dto;
        }

        public async Task<ThesisResponseDto?> GetByIdAsync(Guid id)
        {
            var result = await _thesisRepo.GetThesisByIdAsync(id);
            if (result == null) return null;

            var dto = _mapper.Map<ThesisResponseDto>(result);
            await _abstractService.ResolveAbstractsAsync(new[] { dto });
            _logger.LogInformation("Thesis with Id: {id} successfully fetched", result.Id);
            return dto;
        }

        public async Task<ThesisResponseDto?> GetMyThesisAsync(string callerId)
        {
            // Non-students (admins archiving via the modal) and students without
            // a group simply have "no thesis yet".
            var student = await _studentRepo.GetByIdAsync(callerId);
            if (student?.ResearchGroup is null) return null;

            var thesis = await _thesisRepo.GetByGroupIdAsync(student.ResearchGroup.Id);
            if (thesis is null) return null;

            var dto = _mapper.Map<ThesisResponseDto>(thesis);
            await _abstractService.ResolveAbstractsAsync(new[] { dto });
            return dto;
        }
        public async Task<ThesisResponseDto> SubmitAsync(SubmitThesisDto submitDto, string uploaderId, bool isAdmin = false)
        {
            var thesis = _mapper.Map<ThesisEntity>(submitDto);

            // Admin archival upload (e.g. legacy hard-copy theses): skip the student /
            // research-group checks — GroupId stays null (the one-thesis-per-group rule
            // does not apply) and Status keeps the entity default "Pending".
            if (!isAdmin)
            {
                var student = await _studentRepo.GetByIdAsync(uploaderId);

                if (student == null)
                {
                    throw new InvalidOperationException($"Student profile could not be found.");
                }

                // Only 3rd and 4th year students may submit manuscripts
                // (admin archival uploads bypass this — see isAdmin above).
                if (student.YearLevel is not (3 or 4))
                {
                    throw new InvalidOperationException("Only 3rd and 4th year students may submit a manuscript.");
                }

                if (student.ResearchGroup == null)
                {
                    throw new InvalidOperationException($"You must be part of a research group before submitting a thesis.");
                }

                var groupId = student.ResearchGroup.Id;

                var alreadyExists = await _thesisRepo.ExistsByGroupIdAsync(groupId);

                if (alreadyExists)
                {
                    throw new InvalidOperationException( "This research group already has a thesis submission. " + "Delete the existing thesis before submitting a new one.");
                }

                thesis.GroupId = groupId;
            }

            thesis.SubmittedAt = DateTime.UtcNow;

            // Admin archival metadata (authors + publication year) — kept in
            // memory for the Firestore write below and the Pinecone upsert.
            var authors = SplitAuthors(submitDto.Authors);
            var publicationYear = string.IsNullOrWhiteSpace(submitDto.PublicationYear)
                ? null
                : submitDto.PublicationYear.Trim();

            // Generate the Id here (EF only uses the SQL NEWID() default for
            // Guid.Empty) so the Firestore document ID can be written first and
            // the SQL Abstract column stores that ID instead of the raw text.
            thesis.Id = Guid.NewGuid();
            var result = await _thesisRepo.SubmitAsync(thesis);

            try
            {
                // Admin uploads merge authors + publication year into the same
                // document in the same write; student submissions pass nothing
                // (their authors come from the research group at read time).
                await _abstractService.SetAbstractAsync(
                    thesis.Id, 1, submitDto.Abstract,
                    authors.Count > 0 ? authors : null,
                    publicationYear);
                thesis.Abstract = thesis.Id.ToString();
            }
            catch (Exception ex)
            {
                // Firestore must never block a submission — keep the raw text in
                // the column; readers pass non-GUID values through unchanged.
                _logger.LogError(ex,
                    "Abstract store failed for thesis {ThesisId}; keeping raw text in SQL", thesis.Id);
            }

            

            var initialVersion = new ThesisVersion
            {
                ThesisId = result.Id,
                FilePath = submitDto.FilePath,
                UploadedById = submitDto.UploadedById,
                VersionNumber = 1,
                UploadedAt = DateTime.UtcNow,
                ChangeNote = "Initial Submission",
            };
            await _thesisVersionRepo.CreateThesisVersion(initialVersion);

            // ── Admin archival uploads land FULLY INDEXED ────────────────────
            // The server chunks the abstract itself, reuses the ingestion hop
            // (delete-then-upsert, chunk cap, SQL = source of truth for the
            // blob URL) and lets IngestAsync mark the row "Indexed". Student
            // submissions never enter this block — they stay "Pending" and go
            // through the desktop approve pipeline as before.
            if (isAdmin)
            {
                var ingestResult = await IngestAsync(new IngestThesisDto
                {
                    ThesisId = result.Id,
                    Chunks = BuildAdminChunks(result, submitDto.Abstract, authors, publicationYear),
                });

                if (ingestResult.Status == "Failed" || ingestResult.VectorCount == 0)
                {
                    // Roll back everything so a rejected attempt never leaks a
                    // PDF: SQL row (cascades the version row), Firestore
                    // document (abstract + metadata) and any vectors that
                    // landed before the failure. The controller then deletes
                    // the blob and returns this message to the client.
                    await RollbackAdminUploadAsync(result.Id);

                    throw new InvalidOperationException(
                        "The thesis was uploaded but could not be indexed, so the upload was rolled back. Please try again.");
                }

                _logger.LogInformation(
                    "Admin upload {ThesisId} auto-indexed ({VectorCount} vectors, status {Status})",
                    result.Id, ingestResult.VectorCount, ingestResult.Status);
            }

            var response = _mapper.Map<ThesisResponseDto>(result);
            await _abstractService.ResolveAbstractsAsync(new[] { response });
            return response;
        }

        // "Juan Cruz\nMaria Santos" → ["Juan Cruz", "Maria Santos"].
        // The admin modal sends one author per line; empty lines are dropped.
        private static List<string> SplitAuthors(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return [];

            return raw
                .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(line => line.Length > 0)
                .ToList();
        }

        // Chunks for the admin auto-index path. Url/ThesisId are set from SQL
        // inside IngestAsync anyway — they're filled here so the DTO is
        // self-describing if it is ever logged.
        private static List<ThesisChunkDto> BuildAdminChunks(
            ThesisEntity thesis,
            string abstractText,
            IReadOnlyList<string> authors,
            string? publicationYear)
        {
            var texts = AbstractChunker.Chunk(abstractText);
            var authorsMeta = authors.Count > 0 ? string.Join(", ", authors) : null;

            var chunks = new List<ThesisChunkDto>(texts.Count);
            for (var i = 0; i < texts.Count; i++)
            {
                chunks.Add(new ThesisChunkDto
                {
                    ChunkIndex = i,
                    Text = texts[i],
                    Title = thesis.Title,
                    Url = thesis.FilePath,
                    Authors = authorsMeta,
                    PublicationYear = publicationYear,
                });
            }

            return chunks;
        }

        // Best-effort full teardown of an admin upload whose Pinecone upsert
        // failed: vectors, SQL row (+ cascaded version row) and the Firestore
        // document. The controller handles the blob on the thrown exception.
        private async Task RollbackAdminUploadAsync(Guid thesisId)
        {
            try
            {
                await _pineconeService.DeleteThesisVectorsAsync(thesisId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Vector rollback failed for thesis {ThesisId}", thesisId);
            }

            await _thesisRepo.DeleteThesisAsync(thesisId);

            try
            {
                await _abstractService.DeleteThesisAsync(thesisId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Firestore rollback failed for thesis {ThesisId}", thesisId);
            }
        }
        /// <summary>
        /// Ingestion hop of the RAG pipeline — see the file header for the flow.
        /// Chunks arrive from the desktop pipeline; this method makes the
        /// write idempotent (delete-then-upsert), authoritative (SQL overrides
        /// client metadata), and bounded (chunk cap).
        /// </summary>
        public async Task<IngestThesisResponseDto> IngestAsync(IngestThesisDto dto)
        {
            if (dto.Chunks is null || dto.Chunks.Count == 0)
            {
                _logger.LogWarning("Ingestion for thesis {ThesisId} contained no chunks", dto.ThesisId);
                return new IngestThesisResponseDto
                {
                    ThesisId = dto.ThesisId,
                    VectorCount = 0,
                    Status = "Failed"
                };
            }

            var thesis = await _thesisRepo.GetThesisByIdAsync(dto.ThesisId);
            if (thesis == null)
            {
                _logger.LogWarning("Ingestion rejected: thesis {ThesisId} does not exist in SQL", dto.ThesisId);
                return new IngestThesisResponseDto
                {
                    ThesisId = dto.ThesisId,
                    VectorCount = 0,
                    Status = "Failed"
                };
            }

            try
            {
                // Map DTOs -> chunks. The SQL record is the source of truth for
                // the URL: chunk.Url becomes the permanent blob path, NEVER a
                // SAS link (those expire within minutes and would break citations).
                var chunks = dto.Chunks
                    .Take(Math.Clamp(_pineconeConfig.MaxChunksPerIngest, 1, 256))
                    .Select(c =>
                    {
                        var chunk = _mapper.Map<Chunk>(c);
                        return chunk with
                        {
                            ThesisId = dto.ThesisId.ToString(),
                            Url = thesis.FilePath,
                        };
                    })
                    .ToList();

                // Idempotent re-ingestion: remove any vectors from a previous
                // ingestion of this thesis before writing the new ones.
                await _pineconeService.DeleteThesisVectorsAsync(dto.ThesisId);

                // Batched embed (16/call) + bulk upsert (100/request).
                var upsertedCount = await _pineconeService.UpsertAbstractsAsync(dto.ThesisId, chunks);

                if (upsertedCount == 0)
                {
                    _logger.LogError("Thesis {ThesisId} ingestion failed — no vectors were upserted", dto.ThesisId);
                    return new IngestThesisResponseDto
                    {
                        ThesisId = dto.ThesisId,
                        VectorCount = 0,
                        Status = "Failed"
                    };
                }

                if (upsertedCount < chunks.Count)
                {
                    _logger.LogWarning("Thesis {ThesisId} partially ingested — {Upserted}/{Total} chunks succeeded",
                        dto.ThesisId, upsertedCount, chunks.Count);
                }

                // SQL is only marked Indexed when at least one vector landed.
                await _thesisRepo.UpdateStatusAsync(dto.ThesisId, _mapper.Map<ThesisEntity>(new UpdateThesisStatusDto
                {
                    Status = "Indexed"
                }));

                _logger.LogInformation(
                    "Thesis {ThesisId} ingested — {Count} vectors upserted",
                    dto.ThesisId, upsertedCount);

                return new IngestThesisResponseDto
                {
                    ThesisId = dto.ThesisId,
                    VectorCount = upsertedCount,
                    Status = upsertedCount == chunks.Count ? "Indexed" : "Partial"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ingestion failed for thesis {ThesisId}", dto.ThesisId);

                return new IngestThesisResponseDto
                {
                    ThesisId = dto.ThesisId,
                    VectorCount = 0,
                    Status = "Failed"
                };
            }
        }

        // ────────────────── full-text async ingestion (phase 1) ──────────────────

        /// <inheritdoc />
        public async Task<IngestFullThesisResponseDto> IngestFullAsync(IngestFullThesisDto dto)
        {
            // Full text is required unless the caller already resolved to
            // metadata-only indexing (then the text is optional and unused).
            if ((!dto.MetadataOnly &&
                 (string.IsNullOrWhiteSpace(dto.FullText) ||
                  dto.FullText.Length > _pineconeConfig.MaxFullTextChars)))
            {
                _logger.LogWarning(
                    "Full-text ingestion for thesis {ThesisId} rejected: text {Reason}",
                    dto.ThesisId,
                    string.IsNullOrWhiteSpace(dto.FullText) ? "is empty" : $"exceeds {_pineconeConfig.MaxFullTextChars} chars");
                return new IngestFullThesisResponseDto { ThesisId = dto.ThesisId, Status = "Failed" };
            }

            var thesis = await _thesisRepo.GetThesisByIdAsync(dto.ThesisId);
            if (thesis is null)
            {
                _logger.LogWarning("Full-text ingestion rejected: thesis {ThesisId} does not exist in SQL", dto.ThesisId);
                return new IngestFullThesisResponseDto { ThesisId = dto.ThesisId, Status = "Failed" };
            }

            // SQL is the source of truth for Title/FilePath — client-sent
            // values only fill what SQL doesn't have (title-page metadata the
            // desktop extracted may be fresher than a stale catalog row).
            // Extraction fallbacks like "Unknown" are sentinels, not data:
            // treat them as absent so they never overwrite real SQL/Firestore
            // values or get embedded.
            var dtoTitle = SanitizeSentinel(dto.Title);
            var title = dtoTitle ?? thesis.Title;

            // Title-page extraction is preferred, but when it fails (the
            // common case — title pages rarely carry machine-readable
            // "Authors:" labels) the resolver falls back to Firestore
            // metadata, then the research group's members (the catalog's
            // authors), then SubmittedAt year — so the metadata vector AND
            // every body chunk land with citation-ready authors/year instead
            // of "Author(s): Unknown" → bare [Source n] citations.
            var resolved = await _metadataResolver.ResolveAsync(
                dto.ThesisId,
                preferredAuthors: SanitizeSentinel(dto.Authors),
                preferredPublicationYear: SanitizeSentinel(dto.PublicationYear));
            var authors = resolved.Authors;
            var publicationYear = resolved.PublicationYear;

            string? stagingUrl = null;
            try
            {
                // 1. Re-run the section filter HERE — the server is
                //    authoritative, whatever the desktop pre-flight said.
                //    Chapters 1/3/4/5 are indexed; Chapter 2 (RRL), front
                //    matter and back matter are not. No headings or an empty
                //    keep-set means metadata-only indexing.
                var filter = ThesisSectionFilter.ExtractIndexableSections(dto.MetadataOnly ? null : dto.FullText);
                var metadataOnly = dto.MetadataOnly || !filter.HeadingsDetected || filter.Sections.Count == 0;

                // 2. Idempotent re-ingestion: wipe EVERYTHING from any previous
                //    ingest (legacy abstract chunks, old body chunks, old meta).
                await _pineconeService.DeleteThesisVectorsAsync(dto.ThesisId);

                // 3. Metadata vector FIRST (sync, one embedding call) — the
                //    thesis is citable by title/author/year immediately, even
                //    while the body is still queued.
                var abstractText = await _abstractService.GetLatestAsync(dto.ThesisId);
                var metaChunk = BuildMetadataChunk(thesis, title, authors, publicationYear, abstractText);
                var metaUpserted = await _pineconeService.UpsertMetadataChunkAsync(dto.ThesisId, metaChunk);
                if (metaUpserted == 0)
                {
                    _logger.LogError("Metadata vector upsert failed for thesis {ThesisId}", dto.ThesisId);
                    await TryDeleteBlobAsync(stagingUrl);
                    await _thesisRepo.UpdateIngestStagingUrlAsync(dto.ThesisId, null);
                    return new IngestFullThesisResponseDto { ThesisId = dto.ThesisId, Status = "Failed" };
                }

                // 4a. METADATA-ONLY: no body chunks by design (headings not
                //     detected, or the admin confirmed metadata-only). The
                //     thesis reaches its terminal indexed state right here —
                //     no staging blob, no worker.
                if (metadataOnly)
                {
                    await _thesisRepo.UpdateStatusAsync(dto.ThesisId, new ThesisEntity { Status = "Approved" });
                    await _thesisRepo.UpdatePineconeStatusAsync(dto.ThesisId, "Indexed");

                    _logger.LogWarning(
                        "Thesis {ThesisId} ingested METADATA-ONLY ({Reason}); body chapters were not indexed",
                        dto.ThesisId,
                        dto.MetadataOnly ? "admin confirmed metadata-only" : "no chapter headings detected");

                    return new IngestFullThesisResponseDto
                    {
                        ThesisId = dto.ThesisId,
                        Status = "MetadataOnly",
                        VectorCount = metaUpserted,
                    };
                }

                // 4b. Normal path: stage the full text to blob storage. The
                //     worker carries the text in-memory on the happy path;
                //     this blob is the recovery source if the process restarts
                //     before the job finishes.
                await using (var stream = new MemoryStream(Encoding.UTF8.GetBytes(dto.FullText)))
                {
                    stagingUrl = await _blobService.UploadAsync(
                        stream, "ingest.txt", "text/plain", thesis.Title);
                }
                await _thesisRepo.UpdateIngestStagingUrlAsync(dto.ThesisId, stagingUrl);

                // 5. Approved + Indexing: moderation is done, vectors are
                //    pending. Students don't see the thesis yet (visibility
                //    filter requires Indexed); owner + admin do.
                await _thesisRepo.UpdateStatusAsync(dto.ThesisId, new ThesisEntity { Status = "Approved" });
                await _thesisRepo.UpdatePineconeStatusAsync(dto.ThesisId, "Indexing");

                // 6. Hand the body to the background worker and return.
                _ingestionQueue.Enqueue(new ThesisIngestionJob(
                    dto.ThesisId, stagingUrl, dto.FullText, title, authors, publicationYear));

                _logger.LogInformation(
                    "Thesis {ThesisId} full-text ingestion queued (metadata vector live, {Chars} chars staged, {Sections} indexable sections)",
                    dto.ThesisId, dto.FullText.Length, filter.Sections.Count);

                return new IngestFullThesisResponseDto
                {
                    ThesisId = dto.ThesisId,
                    Status = "Queued",
                    VectorCount = metaUpserted,
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Full-text ingestion could not be queued for thesis {ThesisId}", dto.ThesisId);

                // Roll the staging blob back so a rejected request never leaks
                // a text blob; any vectors that landed are cleaned up so a
                // later retry starts fresh.
                if (stagingUrl is not null)
                {
                    await TryDeleteBlobAsync(stagingUrl);
                    await _thesisRepo.UpdateIngestStagingUrlAsync(dto.ThesisId, null);
                }
                try { await _pineconeService.DeleteThesisVectorsAsync(dto.ThesisId); }
                catch (Exception cleanupEx)
                {
                    _logger.LogWarning(cleanupEx, "Vector rollback failed for thesis {ThesisId}", dto.ThesisId);
                }

                return new IngestFullThesisResponseDto { ThesisId = dto.ThesisId, Status = "Failed" };
            }
        }

        /// <summary>
        /// Extraction fallbacks the desktop may send when a field is absent
        /// ("Unknown", "N/A", …). They mean "no value", so map them to null —
        /// otherwise a placeholder overwrites real values and gets embedded
        /// into vectors.
        /// </summary>
        private static string? SanitizeSentinel(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            var trimmed = value.Trim();
            return trimmed.Equals("Unknown", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.Equals("N/A", StringComparison.OrdinalIgnoreCase)
                ? null
                : trimmed;
        }

        /// <summary>
        /// Metadata vector body: the title-page block (title/authors/year) plus
        /// the abstract when available. Upserting this BEFORE the body chunks
        /// exist is what makes an in-flight thesis citable immediately.
        /// </summary>
        private static Chunk BuildMetadataChunk(
            ThesisEntity thesis,
            string? title,
            string? authors,
            string? publicationYear,
            string? abstractText)
        {
            var sb = new StringBuilder();
            if (!string.IsNullOrWhiteSpace(title)) sb.Append("Title: ").AppendLine(title);
            if (!string.IsNullOrWhiteSpace(authors)) sb.Append("Authors: ").AppendLine(authors);
            if (!string.IsNullOrWhiteSpace(publicationYear)) sb.Append("Publication year: ").AppendLine(publicationYear);
            sb.Append("Abstract: ").Append(string.IsNullOrWhiteSpace(abstractText) ? "(abstract not yet available)" : abstractText);

            return new Chunk(
                Text: sb.ToString(),
                Title: title ?? thesis.Title,
                Url: thesis.FilePath,
                Authors: authors,
                PublicationYear: publicationYear,
                Journal: null,
                RelevanceScore: null,
                ThesisId: thesis.Id.ToString());
        }

        // ────────────────── full-text async ingestion (phase 2) ──────────────────

        /// <inheritdoc />
        public async Task ProcessQueuedIngestionAsync(ThesisIngestionJob job, CancellationToken cancellationToken = default)
        {
            var thesis = await _thesisRepo.GetThesisByIdAsync(job.ThesisId)
                ?? throw new InvalidOperationException($"Thesis {job.ThesisId} no longer exists.");

            // Normal path: text rides in the job. Recovery path (restart):
            // re-download from the staging blob via a short-lived SAS URL.
            var fullText = job.FullText;
            if (string.IsNullOrWhiteSpace(fullText))
            {
                if (string.IsNullOrWhiteSpace(job.StagingBlobUrl))
                    throw new InvalidOperationException($"No staged text available for thesis {job.ThesisId}.");

                var sasUrl = _blobService.GenerateSasUrl(job.StagingBlobUrl, 15);
                using var http = new HttpClient { Timeout = TimeSpan.FromMinutes(2) };
                fullText = await http.GetStringAsync(sasUrl, cancellationToken);
            }

            // Authoritative section filter (same rule IngestFullAsync applied
            // at queue time, re-run here so blob-recovery jobs obey it too):
            // index Chapters 1/3/4/5 only. An empty keep-set means this job
            // must not chunk the raw text — finish as metadata-only instead.
            var filtered = ThesisSectionFilter.ExtractIndexableSections(fullText);
            if (filtered.Sections.Count == 0)
            {
                _logger.LogWarning(
                    "Ingestion job for thesis {ThesisId} produced no indexable sections ({Reason}) — completing metadata-only",
                    job.ThesisId,
                    filtered.HeadingsDetected ? "keep-set is empty" : "no chapter headings detected");

                await _thesisRepo.UpdatePineconeStatusAsync(job.ThesisId, "Indexed", cancellationToken);
                await CleanupStagingAsync(job, cancellationToken);
                return;
            }

            var sectionText = string.Join("\n\n", filtered.Sections);
            var texts = AbstractChunker.Chunk(sectionText)
                .Take(Math.Max(1, _pineconeConfig.MaxChunksPerIngest))
                .ToList();
            if (texts.Count == 0)
                throw new InvalidOperationException($"Full text of thesis {job.ThesisId} produced no chunks.");

            // SQL remains the source of truth for URL; title comes from the
            // job (page-2 metadata) with SQL as fallback. Authors/year: job
            // values preferred, then the resolver's Firestore → research
            // group → SubmittedAt chain — the startup recovery path re-enqueues
            // jobs with nulls, and even the happy path often has neither (the
            // title-page regex misses), which would land every body chunk
            // authorless and force bare [Source n] citations.
            var title = !string.IsNullOrWhiteSpace(job.Title) ? job.Title : thesis.Title;
            var resolved = await _metadataResolver.ResolveAsync(
                job.ThesisId,
                preferredAuthors: job.Authors,
                preferredPublicationYear: job.PublicationYear,
                cancellationToken);
            var chunks = new List<Chunk>(texts.Count);
            for (var i = 0; i < texts.Count; i++)
            {
                chunks.Add(new Chunk(
                    Text: texts[i],
                    Title: title,
                    Url: thesis.FilePath,
                    Authors: resolved.Authors,
                    PublicationYear: resolved.PublicationYear,
                    Journal: null,
                    RelevanceScore: null,
                    ThesisId: job.ThesisId.ToString()));
            }

            // Idempotent retry: wipe only BODY vectors — the metadata vector
            // (already citable) must survive a re-run of this job.
            await _pineconeService.DeleteBodyVectorsAsync(job.ThesisId, cancellationToken);

            var upserted = await _pineconeService.UpsertAbstractsAsync(job.ThesisId, chunks, cancellationToken);
            if (upserted == 0)
                throw new InvalidOperationException($"No body vectors were upserted for thesis {job.ThesisId}.");

            if (upserted < chunks.Count)
                _logger.LogWarning(
                    "Thesis {ThesisId} partially ingested — {Upserted}/{Total} body chunks succeeded",
                    job.ThesisId, upserted, chunks.Count);

            // Body landed: flip the row to Indexed (also sets PineconeStatus
            // and IndexedAt via the repository switch).
            await _thesisRepo.UpdateStatusAsync(job.ThesisId, new ThesisEntity { Status = "Indexed" });

            // Staging blob has served its purpose.
            await CleanupStagingAsync(job, cancellationToken);

            _logger.LogInformation(
                "Thesis {ThesisId} fully ingested — {Count} body vectors + metadata vector live",
                job.ThesisId, upserted);
        }

        /// <summary>
        /// Clears the staging-blob pointer from SQL and deletes the blob
        /// itself — called once a job reaches its terminal state (body
        /// indexed, or metadata-only completion).
        /// </summary>
        private async Task CleanupStagingAsync(ThesisIngestionJob job, CancellationToken cancellationToken)
        {
            await _thesisRepo.UpdateIngestStagingUrlAsync(job.ThesisId, null, cancellationToken);
            if (!string.IsNullOrWhiteSpace(job.StagingBlobUrl))
            {
                try { await _blobService.DeleteAsync(job.StagingBlobUrl); }
                catch (Exception ex) { _logger.LogWarning(ex, "Staging blob cleanup failed for thesis {ThesisId}", job.ThesisId); }
            }
        }

        public async Task<string?> GetDownloadUrlAsync(Guid thesisId)
        {
            var thesis= await _thesisRepo.GetThesisByIdAsync(thesisId);
            if (thesis == null) return null;
            return _blobService.GenerateSasUrl(thesis.FilePath, 15);
        }

        public async Task<bool> UpdateDetailsAsync(Guid id, UpdateThesisDto updateDto, string callerId, bool isAdmin)
        {
            var thesis = await _thesisRepo.GetThesisByIdAsync(id)
                ?? throw new KeyNotFoundException("Thesis not found.");

            // Students may only edit their own group's thesis (Admins bypass).
            if (!isAdmin) await EnsureGroupLeaderAsync(thesis, callerId);

            var dto = _mapper.Map<ThesisEntity>(updateDto);

            // When SQL Abstract holds the Firestore doc ID (current pipeline),
            // overwriting it with raw text would orphan the document and drop
            // the resolved authors/publicationYear from every future read.
            // Route the edited abstract INTO Firestore instead and leave the
            // GUID column untouched; legacy raw-text rows keep the plain
            // column update. Firestore runs first so a failure rejects the
            // whole edit before anything lands in SQL.
            if (dto.Abstract is not null && Guid.TryParse(thesis.Abstract, out _))
            {
                var editedText = dto.Abstract;
                dto.Abstract = null;
                try
                {
                    await _abstractService.UpdateAbstractAsync(id, editedText);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Abstract edit failed for thesis {ThesisId}", id);
                    throw new InvalidOperationException(
                        "The abstract could not be saved, so the update was rejected. Please try again.");
                }
            }

            var result = await _thesisRepo.UpdateDetailsAsync(id, dto);
            if (!result) return false;

            // An "Indexed" thesis otherwise keeps serving the pre-edit title/
            // abstract to MonteAI forever — re-ingest from the stored sources.
            await ReindexEditedThesisAsync(id);

            return true;
        }

        // Best-effort metadata refresh after a catalog edit. Only theses that
        // are already in the vector store are touched. Full-text ingestion
        // means body chunks must NOT be wiped here — a title/abstract edit
        // doesn't change the PDF, so only the metadata vector is replaced
        // (upserting the same thesis_{id}_meta id overwrites it in place).
        // Failures log a warning instead of failing the save (the edit itself
        // already landed).
        private async Task ReindexEditedThesisAsync(Guid thesisId)
        {
            try
            {
                var thesis = await _thesisRepo.GetThesisByIdAsync(thesisId);
                if (thesis is null) return;

                var indexed =
                    string.Equals(thesis.Status, "Indexed", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(thesis.PineconeStatus, "Indexed", StringComparison.OrdinalIgnoreCase);
                if (!indexed) return;

                var response = _mapper.Map<ThesisResponseDto>(thesis);
                await _abstractService.ResolveAbstractsAsync(new[] { response });

                var metaChunk = BuildMetadataChunk(
                    thesis,
                    response.Title,
                    response.Authors is { Count: > 0 } ? string.Join(", ", response.Authors) : null,
                    response.PublicationYear,
                    response.Abstract);

                var upserted = await _pineconeService.UpsertMetadataChunkAsync(thesisId, metaChunk);
                if (upserted == 0)
                {
                    _logger.LogWarning(
                        "Thesis {ThesisId} was edited but its metadata vector could not be refreshed — citations stay stale",
                        thesisId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Metadata refresh after edit failed for thesis {ThesisId}", thesisId);
            }
        }

        public async Task<bool> UpdateStatusAsync(Guid id, UpdateThesisStatusDto updateStatusDto)
        {
            var dto = _mapper.Map<ThesisEntity>(updateStatusDto);

            var result = await _thesisRepo.UpdateStatusAsync(id, dto);

            return result;
        }
        public async Task<bool> DeleteAsync(Guid id)
        {
            // Side-data references (blob URLs, version ids for Firestore) must be
            // read BEFORE the SQL cascade removes the thesis + version rows.
            var thesis = await _thesisRepo.GetThesisByIdAsync(id);
            if (thesis is null) return false;

            var versions = (await _thesisVersionRepo.GetVersionsByThesisId(id)).ToList();

            var result = await _thesisRepo.DeleteThesisAsync(id);

            if (result)
            {
                // Keep the vector store in sync: deleting a thesis must also
                // remove its embeddings, otherwise the chat would keep
                // answering from a document that no longer exists.
                try
                {
                    await _pineconeService.DeleteThesisVectorsAsync(id);
                }
                catch (Exception ex)
                {
                    // The SQL delete already succeeded — log and continue rather
                    // than failing the whole request over orphaned vectors.
                    _logger.LogWarning(ex, "Thesis {ThesisId} deleted from SQL but vector cleanup failed", id);
                }

                // Blobs + Firestore annotations + the abstract doc are best-effort
                // once the SQL rows are gone (same policy as the version cascade).
                foreach (var version in versions)
                    await CleanupVersionAsync(id, version, removeAbstractEntry: false);

                await TryDeleteBlobAsync(thesis.FilePath);

                try
                {
                    await _abstractService.DeleteThesisAsync(id);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Abstract document cleanup failed for thesis {ThesisId}", id);
                }

                _logger.LogInformation(
                    "Thesis {ThesisId} deleted (SQL, vectors, blobs, annotations, abstracts)", id);
            }

            return result;
        }


        // Thesis Version
        public async Task<IEnumerable<ThesisVersionResponseDto>> GetByVersionsAsync(Guid thesisId)
        {
            var result = await _thesisVersionRepo.GetVersionsByThesisId(thesisId);
            _logger.LogInformation("result is {result}", result);
            var dtos = _mapper.Map<IEnumerable<ThesisVersionResponseDto>>(result);
            return dtos;
        }

        public async Task<ThesisVersionResponseDto?> GetByVersionIdAsync(Guid versionId)
        {
            var result = await _thesisVersionRepo.GetByIdAsync(versionId);

            if (result == null) return null;
            var dto = _mapper.Map<ThesisVersionResponseDto>(result);

            return dto;
        }

        public async Task<ThesisVersionResponseDto?> GetLatestThesisIdAsync(Guid thesisId)
        {
            var result = await _thesisVersionRepo.GetLatestThesisIdAsync(thesisId);
            if (result == null) return null;
            var dto = _mapper.Map<ThesisVersionResponseDto>(result);
            return dto;
        }

        public async Task<int> GetNextVersionNumber(Guid thesisId)
        {
            var result = await _thesisVersionRepo.GetNextVersionNumber(thesisId);
            return result;
        }

        public async Task<bool> CreateThesisVersion(CreateThesisVersionDto thesisVersionDto, string uploadedById)
        {
            var student = await _studentRepo.GetByIdAsync(uploadedById);

            if (student == null)
            {
                throw new InvalidOperationException("Student profile could not be found.");
            }

            // Same gate as initial submission — only 3rd/4th years revise.
            if (student.YearLevel is not (3 or 4))
            {
                throw new InvalidOperationException("Only 3rd and 4th year students may submit a revision.");
            }

            if (student.ResearchGroup == null)
            {
                throw new InvalidOperationException("You must be part of a research group to submit a revised thesis.");
           }

            var thesis = await _thesisRepo.GetThesisByIdAsync(thesisVersionDto.ThesisId);

            if (thesis == null)
            {
                throw new InvalidOperationException("Thesis could not be found.");
            }

            if (thesis.GroupId != student.ResearchGroup.Id)
            {
                throw new UnauthorizedAccessException("You are not authorized to submit a revision for this thesis.");
            }

            if (!string.Equals(student.Position, "Leader", StringComparison.OrdinalIgnoreCase))
            {
                throw new UnauthorizedAccessException("Only the research group leader can submit a revised thesis.");
            }

            var dto = _mapper.Map<ThesisVersion>(thesisVersionDto);
            dto.UploadedById = uploadedById;
            dto.UploadedAt = DateTime.UtcNow;
            dto.VersionNumber = await _thesisVersionRepo.GetNextVersionNumber(thesisVersionDto.ThesisId);

            // Optional revised abstract — store it BEFORE creating the version so
            // a Firestore failure surfaces to the client instead of silently
            // losing the author's text while the PDF still lands.
            if (!string.IsNullOrWhiteSpace(thesisVersionDto.Abstract))
            {
                await _abstractService.SetAbstractAsync(
                    thesisVersionDto.ThesisId, dto.VersionNumber, thesisVersionDto.Abstract);
            }

            return await _thesisVersionRepo.CreateThesisVersion(dto);
        }

        public async Task<bool> DeleteThesisVersion(Guid thesisId, string callerId, bool isAdmin)
        {
            var thesis = await _thesisRepo.GetThesisByIdAsync(thesisId)
                ?? throw new KeyNotFoundException("Thesis not found.");

            // Students may only prune their own group's thesis versions (Admins bypass).
            if (!isAdmin) await EnsureGroupLeaderAsync(thesis, callerId);

            var versions = (await _thesisVersionRepo.GetVersionsByThesisId(thesisId))
                .OrderBy(v => v.VersionNumber)
                .ToList();

            if (versions.Count == 0) return false;

            // Everything but the newest version gets pruned — and each pruned
            // version takes its blob/annotations/abstract entry with it, so
            // pruning can't leak storage.
            var pruned = versions.Take(versions.Count - 1).ToList();
            if (pruned.Count > 0)
            {
                var result = await _thesisVersionRepo.DeleteAllExceptLatestAsync(thesisId);
                if (!result) return false;

                foreach (var version in pruned)
                    await CleanupVersionAsync(thesisId, version);
            }

            return true;
        }

        public async Task<bool> DeleteThesisVersionById(Guid thesisId, Guid versionId, string callerId, bool isAdmin)
        {
            var thesis = await _thesisRepo.GetThesisByIdAsync(thesisId)
                ?? throw new KeyNotFoundException("Thesis not found.");

            // Students: group leader only, same rule as revisions (Admins bypass).
            if (!isAdmin) await EnsureGroupLeaderAsync(thesis, callerId);

            var version = await _thesisVersionRepo.GetByIdAsync(versionId)
                ?? throw new KeyNotFoundException("Thesis version not found.");

            if (version.ThesisId != thesisId)
                throw new KeyNotFoundException("Thesis version not found.");

            var versions = (await _thesisVersionRepo.GetVersionsByThesisId(thesisId))
                .OrderBy(v => v.VersionNumber)
                .ToList();

            // Latest-only rule: versions are pruned from the top (3→2→1) so
            // version history stays contiguous.
            if (versions.Count == 0 || versions[^1].Id != version.Id)
                throw new InvalidOperationException("Only the latest thesis version can be deleted.");

            if (versions.Count == 1)
            {
                // Deleting the final version removes the whole thesis — an empty
                // shell (title, status, schedule) with nothing to view is worse
                // than an honest "not found". DeleteAsync handles the full
                // teardown (SQL, vectors, blobs, annotations, abstract doc).
                if (!await DeleteAsync(thesis.Id))
                    throw new KeyNotFoundException("Thesis not found.");

                _logger.LogInformation("Thesis {ThesisId} fully deleted with its last version", thesis.Id);
                return true;
            }

            var deleted = await _thesisVersionRepo.DeleteAsync(version.Id);
            if (!deleted) return false;

            await CleanupVersionAsync(thesisId, version);
            return true;
        }

        // Best-effort teardown of one version's side data — the SQL row is
        // already gone when this runs, so failures are logged, never surfaced.
        private async Task CleanupVersionAsync(Guid thesisId, ThesisVersion version, bool removeAbstractEntry = true)
        {
            try
            {
                // Annotations: theses/{thesisId}/versions/{versionId}/annotations
                var annotations = _firestore
                    .Collection("theses").Document(thesisId.ToString())
                    .Collection("versions").Document(version.Id.ToString())
                    .Collection("annotations");

                var snapshot = await annotations.GetSnapshotAsync();
                foreach (var doc in snapshot.Documents)
                    await doc.Reference.DeleteAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Annotation cleanup failed for version {VersionId}", version.Id);
            }

            if (removeAbstractEntry)
            {
                try
                {
                    await _abstractService.RemoveVersionAsync(thesisId, version.VersionNumber);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Abstract cleanup failed for version {VersionId}", version.Id);
                }
            }

            await TryDeleteBlobAsync(version.FilePath);
        }

        private async Task TryDeleteBlobAsync(string? blobUrl)
        {
            if (string.IsNullOrWhiteSpace(blobUrl))
            {
                _logger.LogWarning("Blob cleanup skipped — no FilePath stored for this record");
                return;
            }

            try
            {
                await _blobService.DeleteAsync(blobUrl);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Blob cleanup failed for {BlobUrl}", blobUrl);
            }
        }

        private async Task EnsureGroupLeaderAsync(ThesisEntity thesis, string callerId)
        {
            var student = await _studentRepo.GetByIdAsync(callerId)
                ?? throw new UnauthorizedAccessException("Student profile could not be found.");

            // GroupId is null for admin-archived theses, so a student never matches those.
            if (student.ResearchGroup is null || thesis.GroupId != student.ResearchGroup.Id)
                throw new UnauthorizedAccessException("You are not authorized to modify this thesis.");

            if (!string.Equals(student.Position, "Leader", StringComparison.OrdinalIgnoreCase))
                throw new UnauthorizedAccessException("Only the research group leader can modify this thesis.");
        }

    }
}