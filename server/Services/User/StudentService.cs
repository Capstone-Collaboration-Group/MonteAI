using AutoMapper;
using server.Models.Entities;
using server.Models.DTOs.User;
using server.Models.DTOs.Student;
using server.Mappings;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

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

        public async Task<string?> GetEmailByStudentNumberAsync(string studentNumber)
        {
            var student = await _repo.GetByStudentNumberAsync(studentNumber);
            return student?.Email;
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

        public async Task<IEnumerable<StudentResponseDto>> GetDirectoryAsync(string? search, string? program)
        {
            var students = (await _repo.GetAllAsync()).ToList();

            if (!string.IsNullOrWhiteSpace(program))
            {
                var normalized = program.Trim();
                students = students
                    .Where(s => string.Equals(
                        s.Program?.Trim(),
                        normalized,
                        StringComparison.OrdinalIgnoreCase))
                    .ToList();
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var query = search.Trim().ToLowerInvariant();
                students = students
                    .Where(s =>
                        $"{s.FirstName} {s.MiddleInitial} {s.LastName} {s.Suffix}"
                            .ToLowerInvariant()
                            .Contains(query) ||
                        (s.StudentNumber ?? string.Empty)
                            .ToLowerInvariant()
                            .Contains(query))
                    .ToList();
            }

            return _mapper.Map<IEnumerable<StudentResponseDto>>(students);
        }

        public async Task<StudentResponseDto?> GetProfileByIdAsync(string id)
        {
            var student = await _repo.GetByIdAsync(id);
            return student == null ? null : _mapper.Map<StudentResponseDto>(student);
        }

    }
}
