using AutoMapper;
using server.Models.DTOs.Thesis;
using server.Repositories;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

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

    }
}