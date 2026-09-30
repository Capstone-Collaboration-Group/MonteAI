using server.Models.Entities;

namespace server.Repositories.Interfaces
{
    public interface IAdminRepository
    {
        Task<IEnumerable<Admin>> GetAllAdminsAsync();
        Task<Admin?> GetAdminByIdAsync(string id);

        Task<bool> UpdateAdminAsync(Admin admin, string id);

        Task<bool> CreateAdminAsync(Admin admin);

        Task<bool> DeleteAdminAsync(string id);
    }
}