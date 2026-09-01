using AutoMapper;
using server.Models.DTOs.Thesis;
using server.Services.Interfaces;
using ThesisEntity = server.Models.Entities.Thesis;
using server.Repositories;
using server.Repositories.Interfaces;
using server.Models.Retrieval;
using server.Models.Entities;


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

        public ThesisService(IThesisRepository repo, IThesisVersionRepository thesisVersionRepo, IScheduleRepository scheduleRepository, ILogger<ThesisService> logger, IMapper mapper, IPineconeService pineconeService, IBlobService blobService)
        {
            _thesisRepo = repo;
            _thesisVersionRepo = thesisVersionRepo;
            _scheduleRepository = scheduleRepository;
            _logger = logger;
            _mapper = mapper;
            _pineconeService = pineconeService;
            _blobService = blobService;
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
                    dto.ScheduledAt = schedule.Date.ToDateTime(schedule.StartTime);
                    dto.ScheduledVenue = schedule.RoomVenue;
                }

                return dto;
            });
            _logger.LogInformation("Nandito ka yowww");

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
        public async Task<IngestThesisResponseDto> IngestAsync(IngestThesisDto dto)
        {
            try
            {
                 var upsertTasks = dto.Chunks.Select((chunkDto, index) => 
                    _pineconeService.UpsertAbstractAsync(
                        id: $"thesis_{dto.ThesisId}_chunk_{chunkDto.ChunkIndex}",
                        chunk: _mapper.Map<Chunk>(chunkDto)
                    )
                );
            var results = await Task.WhenAll(upsertTasks);
            var upsertedCount =  results.Count(r => r);

            if(upsertedCount < dto.Chunks.Count)
            {
                _logger.LogWarning("Thesis {ThesisId} partially ingested — {Upserted}/{Total} chunks succeeded",
                dto.ThesisId, upsertedCount, dto.Chunks.Count);
            };

            await _thesisRepo.UpdateStatusAsync(dto.ThesisId, _mapper.Map<ThesisEntity>(new UpdateThesisStatusDto 
                {
                    Status = "Indexed"
                }));
                _logger.LogInformation(
                    "Thesis {ThesisId} ingested — {Count} vectors upserted",
                    dto.ThesisId, upsertedCount

                );
                return new IngestThesisResponseDto
                {
                    ThesisId = dto.ThesisId,
                    VectorCount = upsertedCount,
                    Status = "Indexed"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ingestion failed for thesis {ThesisId}", dto.ThesisId);

                return new IngestThesisResponseDto
                {
                    ThesisId    = dto.ThesisId,
                    VectorCount = 0,
                    Status      = "Failed"
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