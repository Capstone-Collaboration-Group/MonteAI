using AutoMapper;
using Google.Cloud.Firestore;
using Microsoft.Extensions.Options;
using server.Configuration;
using server.Models.DTOs.Thesis;
using server.Services.Interfaces;
using ThesisEntity = server.Models.Entities.Thesis;
using server.Repositories;
using server.Repositories.Interfaces;
using server.Models.Retrieval;
using server.Models.Entities;


// server/Services/Theses/ThesisService.cs
//
// Thesis lifecycle, including the INGESTION hop of the RAG pipeline:
//
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
            IOptions<PineconeConfig> pineconeConfig)
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
        }

        public async Task<IEnumerable<ThesisResponseDto>> GetFirst20ThesisAsync(string? program = null)
        {
            var result = await _thesisRepo.GetFirst20ThesisAsync(program);

            var dtos = result.Select(thesis =>
            {
                var dto = _mapper.Map<ThesisResponseDto>(thesis);

                // Pick the latest schedule for this group if multiple exist
                var schedule = thesis.ResearchGroup?.Schedules
                    .OrderByDescending(s => s.Date)
                    .FirstOrDefault();

                if (schedule is not null)
                {
                    dto.GroupId = schedule.GroupId;
                    dto.ScheduledAt = schedule.Date.ToDateTime(schedule.StartTime);
                    dto.ScheduledVenue = schedule.RoomVenue;
                }

                return dto;
            }).ToList();

            // SQL holds the Firestore doc ID (legacy rows hold raw text) — swap
            // in the actual abstract text before the client ever sees it.
            await _abstractService.ResolveAbstractsAsync(dtos);

            return dtos;

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

            // Generate the Id here (EF only uses the SQL NEWID() default for
            // Guid.Empty) so the Firestore document ID can be written first and
            // the SQL Abstract column stores that ID instead of the raw text.
            thesis.Id = Guid.NewGuid();
            var result = await _thesisRepo.SubmitAsync(thesis);

            try
            {
                await _abstractService.SetAbstractAsync(thesis.Id, 1, submitDto.Abstract);
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

            var response = _mapper.Map<ThesisResponseDto>(result);
            await _abstractService.ResolveAbstractsAsync(new[] { response });
            return response;
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
            var result = await _thesisRepo.UpdateDetailsAsync(id, dto);

            return result;
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