using AutoMapper;
using server.Models.DTOs.Thesis;
using server.Services.Interfaces;
using ThesisEntity = server.Models.Entities.Thesis;
using server.Repositories;
using server.Repositories.Interfaces;
using server.Models.Retrieval;
using server.Services.AI;


namespace server.Services.Theses
{
    public class ThesisService : IThesisService
    {
        private readonly IThesisRepository _repo;
        private readonly ILogger<ThesisService> _logger;
        private readonly IMapper _mapper;
        private readonly IPineconeService _pineconeService;

        public ThesisService(IThesisRepository repo, ILogger<ThesisService> logger, IMapper mapper, IPineconeService pineconeService)
        {
            _repo = repo;
            _logger = logger;
            _mapper = mapper;
            _pineconeService = pineconeService;
        }

        public async Task<IEnumerable<ThesisResponseDto>> GetFirst20ThesisAsync()
        {
            var result = await _repo.GetFirst20ThesisAsync();

            var dtos = _mapper.Map<IEnumerable<ThesisResponseDto>>(result);

            _logger.LogInformation("Nandito ka yowww");

            return dtos;

        }

        public async Task<ThesisResponseDto?> GetByIdAsync(Guid id)
        {
            var result = await _repo.GetThesisByIdAsync(id);
            if (result == null) return null;

            var dto = _mapper.Map<ThesisResponseDto>(result);
            _logger.LogInformation("Thesis with Id: {id} successfully fetched", result.Id);

            return dto;
            
        }
        public async Task<ThesisResponseDto> SubmitAsync(SubmitThesisDto submitDto)
        {

            var thesis = _mapper.Map<ThesisEntity>(submitDto);

            thesis.SubmittedAt = DateTime.UtcNow;

            var result = await _repo.SubmitAsync(thesis);

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

            await _repo.UpdateStatusAsync(dto.ThesisId, _mapper.Map<ThesisEntity>(new UpdateThesisStatusDto 
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

        public async Task<bool> UpdateDetailsAsync(Guid id, UpdateThesisDto updateDto)
        {
            var dto =  _mapper.Map<ThesisEntity>(updateDto);
            var result = await _repo.UpdateDetailsAsync(id, dto);


            return result;
        }

        public async Task<bool> UpdateStatusAsync(Guid id, UpdateThesisStatusDto updateStatusDto)
        {
            var dto = _mapper.Map<ThesisEntity>(updateStatusDto);

            var result = await _repo.UpdateStatusAsync(id, dto);

            return result;
        }
        public async Task<bool> DeleteAsync(Guid id)
        {
            var result = await _repo.DeleteThesisAsync(id);
            return result;

        }

    }
}