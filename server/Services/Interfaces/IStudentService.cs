using server.Models.DTOs.Student;
using server.Models.DTOs.User;

namespace server.Services.Interfaces
{
    public interface IStudentService
    {
        Task<UserResponseDto> RegisterAsync(RegisterUserDto dto, string firebaseUid);
        Task<UserResponseDto?> GetByIdAsync(string id);
        Task<string?> GetEmailByStudentNumberAsync(string studentNumber);

        Task<IEnumerable<UserResponseDto>> GetAllAsync();

        Task<UserResponseDto?> UpdateAsync(string id, UpdateUserDto dto);

        Task<bool> DeactivateAsync(string id);

        /// <summary>
        /// Student directory used for research-group invitations. Optionally
        /// filtered by free-text search (full name or student number) and by
        /// program. Returns the full student profile shape.
        /// </summary>
        Task<IEnumerable<StudentResponseDto>> GetDirectoryAsync(string? search, string? program);

        Task<StudentResponseDto?> GetProfileByIdAsync(string id);
    }
}
