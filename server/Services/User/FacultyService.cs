using AutoMapper;
using server.Models.DTOs.Faculty;
using server.Models.Entities;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

namespace server.Services.User
{
    public class FacultyService : IFacultyService
    {
        private readonly IFacultyRepository _repo;
        private readonly ILogger<FacultyService> _logger;
        private readonly IMapper _mapper;

        public FacultyService(IFacultyRepository repo, ILogger<FacultyService> logger, IMapper mapper)
        {
            _repo = repo;
            _logger = logger;
            _mapper = mapper;
        }

        public async Task<IEnumerable<FacultyResponseDto>> GetAllAsync()
        {
            var result = await _repo.GetAllFacultyAsync();
            var dto = _mapper.Map<IEnumerable<FacultyResponseDto>>(result);
            _logger.LogInformation("Fetched {count} faculties", dto.Count());

            return dto;
        }

        public async Task<FacultyResponseDto?> GetByIdAsync(string id )
        {
            var result = await _repo.GetFacultyByIdAsync(id);
            var dto = _mapper.Map<FacultyResponseDto>(result);

            _logger.LogInformation("Fetched Faculty with Id: {id}", dto.Id);

            return dto;
        }

        public async Task<bool> CreateAsync(CreateFacultyDto createDto)
        {
            var faculty = _mapper.Map<Faculty>(createDto);
            faculty.CreatedAt = DateTime.UtcNow;
            var result = await _repo.CreateFacultyAsync(faculty);

            _logger.LogInformation("Created Faculty with Id: {Id}", faculty.Id);
            return result;
        }
        public async Task<bool> UpdateAsync(UpdateFacultyDto updateDto)
        {
            var faculty = _mapper.Map<Faculty>(updateDto);
            faculty.UpdatedAt = DateTime.UtcNow;
            var result = await _repo.UpdateFacultyAsync(faculty);
            _logger.LogInformation("Performed Updating of Faculty: {Name} ", faculty.FirstName);

            return result;
        }
        public async Task<bool> DeleteAsync(string id)
        {
            var result = await _repo.DeleteFacultyAsync(id);
            _logger.LogInformation("Performing Deletion on Faculty: {Id}", id);
            if (result) _logger.LogWarning("Faculty with Id: {id} deleted successfully", id);
            return result;
        }

    }
}