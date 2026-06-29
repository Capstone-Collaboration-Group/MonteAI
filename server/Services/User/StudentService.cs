using server.Mappings;
using server.Models.DTOs.User;
using server.Repositories.Interfaces;
using server.Services.Interfaces;
using AutoMapper;
using server.Models.Entities;

namespace server.Services.User
{
    public class StudentService : IStudentService
    {
        private readonly IStudentRepository _repo;
        private readonly ILogger<StudentService> _logger;
        private readonly IMapper _mapper;

        public StudentService(IStudentRepository repo, ILogger<StudentService> logger, IMapper mapper)
        {
            _repo = repo;
            _logger = logger;
            _mapper = mapper;
        }


        //RegisterAsync
        //GetByIdAsync
        //GetAllAsync
        //UpdateAsync
        //DeactivateAsync

        public async Task<UserResponseDto> RegisterAsync(RegisterUserDto dto, string firebaseUid)
        {
            var student = _mapper.Map<Student>(dto);
            student.Id = firebaseUid;
            student.IsActive = true;
            student.CreatedAt = DateTime.UtcNow;
            student.UpdatedAt = DateTime.UtcNow;

            await _repo.CreateAsync(student);

            _logger.LogInformation("Student Registered: {Id}", firebaseUid);

            return _mapper.Map<UserResponseDto>(student);
        }

        public async Task<UserResponseDto?> GetByIdAsync(string id)
        {
            var student = await _repo.GetByIdAsync(id);
            if (student == null) return null;

            return _mapper.Map<UserResponseDto>(student);
        }

        public async Task<IEnumerable<UserResponseDto>> GetAllAsync()
        {
            var students = await _repo.GetAllAsync();

            return _mapper.Map<IEnumerable<UserResponseDto>>(students);
        }

        public async Task<UserResponseDto?> UpdateAsync(string id, UpdateUserDto dto)
        {
            var student = await _repo.GetByIdAsync(id);
            if (student == null) return null;

            _mapper.Map(dto, student);

            student.UpdatedAt = DateTime.UtcNow;

            await _repo.UpdateAsync(student);

            _logger.LogInformation("Student Updated: {Id}", id);

            return _mapper.Map<UserResponseDto>(student);
        }

        public async Task<bool> DeactivateAsync(string id)
        {
            var student = await _repo.GetByIdAsync(id);
            if (student == null) return false;

            student.IsActive = false;
            student.UpdatedAt = DateTime.UtcNow;

            await _repo.UpdateAsync(student);

            _logger.LogInformation("Student Active Status Updated: {id}", id);

            return true;

        }

    }
}
