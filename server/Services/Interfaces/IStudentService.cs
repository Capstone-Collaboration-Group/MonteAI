using server.Models.DTOs.User;

namespace server.Services.Interfaces
{
    public interface IStudentService
    {
        Task<UserResponseDto> RegisterAsync(RegisterUserDto dto, string firebaseUid);
        Task<UserResponseDto?> GetByIdAsync(string id);

        Task<IEnumerable<UserResponseDto>> GetAllAsync();

        Task<UserResponseDto?> UpdateAsync(string id, UpdateUserDto dto);

        Task<bool> DeactivateAsync(string id);
    }
}
