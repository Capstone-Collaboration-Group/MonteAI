using server.Models.Entities;

namespace server.Repositories.Interfaces
{
    public interface IThesisRepository
    {
        Task<IEnumerable<Thesis>> GetFirst20ThesisAsync();

        Task<Thesis?> GetThesisByIdAsync(Guid id);

        Task<bool> UpdateDetailsAsync(Thesis thesis);

        Task<bool> UpdateStatusAsync(Guid id, string status);

        Task<bool> DeleteThesisAsync(Guid id);


    }
}
