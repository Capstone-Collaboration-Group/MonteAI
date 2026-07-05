using AutoMapper;
using server.Models.DTOs.Thesis;
using server.Services.Interfaces;
using ThesisEntity = server.Models.Entities.Thesis;
using server.Repositories;
using server.Repositories.Interfaces;


namespace server.Services
{
    public class ThesisService : IThesisService
    {
        private readonly IThesisRepository _repo;
        private readonly ILogger<ThesisService> _logger;
        private readonly IMapper _mapper;

        public ThesisService(IThesisRepository repo, ILogger<ThesisService> logger, IMapper mapper)
        {
            _repo = repo;
            _logger = logger;
            _mapper = mapper;
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