using server.Models.Entities;

namespace server.Repositories.Interfaces
{
    public interface IFacultyRepository
    {
        Task<IEnumerable<Faculty>> GetAllFacultyAsync();

        Task<Faculty?> GetFacultyByIdAsync(string id);

        Task<bool> CreateFacultyAsync(Faculty faculty);

        Task<bool> UpdateFacultyAsync(Faculty faculty);

        Task<bool> DeleteFacultyAsync(string id);
    }
}