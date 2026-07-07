using server.Models.DTOs.Admin;
using server.Models.DTOs.User;

namespace server.Services.Interfaces
{
    public interface IAdminService
    {
        Task<IEnumerable<UserResponseDto>> GetAllAsync();

        Task<UserResponseDto> GetByIdAsync(string id);

        Task<bool> CreateAsync(RegisterUserDto admin);

        Task<bool> UpdateAsync(UpdateUserDto admin);

        Task<bool> DeleteAsync(string id);

    }
}