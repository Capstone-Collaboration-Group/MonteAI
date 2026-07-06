using server.Models.DTOs.Admin;

namespace server.Services.Interfaces
{
    public interface IAdminService
    {
        Task<IEnumerable<AdminResponseDto>> GetAllAsync();

        Task<AdminResponseDto> GetByIdAsync(string id);

        Task<bool> CreateAsync(CreateAdminDto admin);

        Task<bool> UpdateAsync(UpdateAdminDto admin);

        Task<bool> DeleteAsync(string id);

    }
}