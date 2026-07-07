using AutoMapper;
using server.Models.DTOs.Faculty;
using server.Models.DTOs.User;
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

        public async Task<IEnumerable<UserResponseDto>> GetAllAsync()
        {
            var result = await _repo.GetAllFacultyAsync();
            var dto = _mapper.Map<IEnumerable<UserResponseDto>>(result);
            _logger.LogInformation("Fetched {count} faculties", dto.Count());

            return dto;
        }

        public async Task<UserResponseDto?> GetByIdAsync(string id)
        {
            
            var result = await _repo.GetFacultyByIdAsync(id);
            _logger.LogInformation("result is {result}", result);
            var dto = _mapper.Map<UserResponseDto>(result);

            

            return dto;
        }

        public async Task<bool> CreateAsync(RegisterUserDto createDto)
        {
            var faculty = _mapper.Map<Faculty>(createDto);
            faculty.CreatedAt = DateTime.UtcNow;
            var result = await _repo.CreateFacultyAsync(faculty);

            _logger.LogInformation("Created Faculty with Id: {Id}", faculty.Id);
            return result;
        }
        public async Task<bool> UpdateAsync(UpdateUserDto updateDto)
        {
            var faculty = _mapper.Map<Faculty>(updateDto);
            faculty.UpdatedAt = DateTime.UtcNow;
            var result = await _repo.UpdateFacultyAsync(faculty);
            

            return result;
        }
        public async Task<bool> DeleteAsync(string id)
        {
            var result = await _repo.DeleteFacultyAsync(id);
            
            if (result) _logger.LogWarning("Faculty with Id: {id} deleted successfully", id);
            return result;
        }

    }
}