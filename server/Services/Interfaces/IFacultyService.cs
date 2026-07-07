using server.Models.DTOs.Faculty;
using server.Models.DTOs.User;

namespace server.Services.Interfaces
{
    public interface IFacultyService
    {
        Task<IEnumerable<UserResponseDto>> GetAllAsync();
        Task<UserResponseDto?> GetByIdAsync(string id);
        Task<bool> CreateAsync(RegisterUserDto createDto);
        Task<bool> UpdateAsync(UpdateUserDto updateDto);
        Task<bool> DeleteAsync(string id);

    }
}