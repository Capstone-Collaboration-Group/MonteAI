using AutoMapper;
using Google.Cloud.Firestore;
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
//   METADATA-ONLY INGESTION (single synchronous path):
//   Desktop / admin archival                Server (this service)
//   ──────────────────────                  ─────────────────────
//   approve / reindex /                    -> IngestAsync(thesisId):
//   admin archival upload                     1. load thesis from SQL (authoritative
//                                               Title/FilePath)
//                                             2. resolve authors/year (Firestore ->
//                                               research group -> SubmittedAt) and
//                                               the abstract (Firestore)
//                                             3. DELETE old vectors for this thesis
//                                               (idempotent re-ingestion, incl.
//                                               legacy full-text chunks)
//                                             4. embed + upsert ONE metadata vector
//                                               (thesis_{id}_meta) — no body chunks
//                                             5. SQL: Status=Approved → Indexed
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
        private readonly IStudentRepository _studentRepo;
        private readonly IThesisAbstractService _abstractService;
        private readonly FirestoreDb _firestore;
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
            // The server ingests the metadata vector itself (delete-then-
            // upsert, SQL = source of truth for title/FilePath; authors/year
            // already stored in Firestore during submit resolve through the
            // metadata resolver) and lets IngestAsync mark the row "Indexed".
            // Student submissions never enter this block — they stay "Pending"
            // and go through the desktop approve pipeline as before.
            if (isAdmin)
            {
                var ingestResult = await IngestAsync(new IngestThesisDto
                {
                    ThesisId = result.Id,
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
        /// Ingestion hop of the RAG pipeline — METADATA-ONLY, synchronous.
        /// See the file header for the flow. The SQL record is the source of
        /// truth for Title/FilePath; authors/year resolve via the metadata
        /// resolver (Firestore → research group → SubmittedAt) and the
        /// abstract comes from the Firestore abstract store. Re-ingestion is
        /// idempotent: old vectors (including any legacy full-text chunks)
        /// are deleted before the single metadata vector is upserted.
        /// </summary>
        public async Task<IngestThesisResponseDto> IngestAsync(IngestThesisDto dto)
        {
            var thesis = await _thesisRepo.GetThesisByIdAsync(dto.ThesisId);
            if (thesis is null)
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
                var resolved = await _metadataResolver.ResolveAsync(dto.ThesisId);
                var abstractText = await _abstractService.GetLatestAsync(dto.ThesisId);

                // Legacy rows keep the raw abstract text in the SQL column
                // (non-GUID) — the store write failed at submit time. Use it
                // when Firestore has nothing, so ingestion never embeds the
                // placeholder for a thesis that DID provide an abstract.
                if (string.IsNullOrWhiteSpace(abstractText) &&
                    !string.IsNullOrWhiteSpace(thesis.Abstract) &&
                    !Guid.TryParse(thesis.Abstract, out _))
                {
                    abstractText = thesis.Abstract;
                }

                var metaChunk = BuildMetadataChunk(
                    thesis, thesis.Title, resolved.Authors, resolved.PublicationYear, abstractText);

                // Idempotent re-ingestion: remove any vectors from a previous
                // ingestion of this thesis before writing the new one.
                await _pineconeService.DeleteThesisVectorsAsync(dto.ThesisId);

                var upserted = await _pineconeService.UpsertMetadataChunkAsync(dto.ThesisId, metaChunk);
                if (upserted == 0)
                {
                    _logger.LogError("Metadata vector upsert failed for thesis {ThesisId}", dto.ThesisId);
                    return new IngestThesisResponseDto
                    {
                        ThesisId = dto.ThesisId,
                        VectorCount = 0,
                        Status = "Failed"
                    };
                }

                // Approved stamps ApprovedAt; Indexed stamps IndexedAt and
                // PineconeStatus=Indexed via the repository switch. Approving
                // IS this endpoint — there is no separate moderation hop on
                // this path.
                await _thesisRepo.UpdateStatusAsync(dto.ThesisId, new ThesisEntity { Status = "Approved" });
                await _thesisRepo.UpdateStatusAsync(dto.ThesisId, new ThesisEntity { Status = "Indexed" });

                _logger.LogInformation(
                    "Thesis {ThesisId} ingested (metadata vector only, {Count} vector)",
                    dto.ThesisId, upserted);

                return new IngestThesisResponseDto
                {
                    ThesisId = dto.ThesisId,
                    VectorCount = upserted,
                    Status = "Indexed"
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

        /// <summary>
        /// Metadata vector body: the title/author/year block plus the abstract
        /// when available. Upserting the same thesis_{id}_meta id REPLACES the
        /// previous vector — this is how re-ingestion and catalog edits
        /// refresh citation metadata.
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
        // are already in the vector store are touched: the metadata vector is
        // replaced in place (upserting the same thesis_{id}_meta id overwrites
        // it). Failures log a warning instead of failing the save (the edit
        // itself already landed).
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