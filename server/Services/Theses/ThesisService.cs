using AutoMapper;
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

        public ThesisService(
            IThesisRepository repo,
            IThesisVersionRepository thesisVersionRepo,
            IScheduleRepository scheduleRepository,
            ILogger<ThesisService> logger,
            IMapper mapper,
            IPineconeService pineconeService,
            IBlobService blobService,
            IOptions<PineconeConfig> pineconeConfig)
        {
            _thesisRepo = repo;
            _thesisVersionRepo = thesisVersionRepo;
            _scheduleRepository = scheduleRepository;
            _logger = logger;
            _mapper = mapper;
            _pineconeService = pineconeService;
            _blobService = blobService;
            _pineconeConfig = pineconeConfig.Value;
        }

        public async Task<IEnumerable<ThesisResponseDto>> GetFirst20ThesisAsync()
        {
            var result = await _thesisRepo.GetFirst20ThesisAsync();

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
            });

            return dtos;

        }

        public async Task<ThesisResponseDto?> GetByIdAsync(Guid id)
        {
            var result = await _thesisRepo.GetThesisByIdAsync(id);
            if (result == null) return null;

            var dto = _mapper.Map<ThesisResponseDto>(result);
            _logger.LogInformation("Thesis with Id: {id} successfully fetched", result.Id);
            return dto;
        }
        public async Task<ThesisResponseDto> SubmitAsync(SubmitThesisDto submitDto)
        {

            var thesis = _mapper.Map<ThesisEntity>(submitDto);

            thesis.SubmittedAt = DateTime.UtcNow;

            var result = await _thesisRepo.SubmitAsync(thesis);

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
            
            return _mapper.Map<ThesisResponseDto>(result);
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

        public async Task<bool> UpdateDetailsAsync(Guid id, UpdateThesisDto updateDto)
        {
            var dto =  _mapper.Map<ThesisEntity>(updateDto);
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
            var dto = _mapper.Map<ThesisVersion>(thesisVersionDto);
            dto.UploadedById = uploadedById;
            dto.UploadedAt = DateTime.UtcNow;
            dto.VersionNumber = await _thesisVersionRepo.GetNextVersionNumber(thesisVersionDto.ThesisId);
            var result = await _thesisVersionRepo.CreateThesisVersion(dto);
            return result;
        }

        public async Task<bool> DeleteThesisVersion(Guid thesisId)
        {
            var result = await _thesisVersionRepo.DeleteAllExceptLatestAsync(thesisId);
            return result;
        }

    }
}