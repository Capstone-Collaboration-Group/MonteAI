using server.Models.DTOs.Thesis;
using server.Models.Entities;

namespace server.Repositories.Interfaces
{
    public interface IThesisRepository
    {
        Task<IEnumerable<Thesis>> GetFirst20ThesisAsync();

        Task<Thesis?> GetThesisByIdAsync(Guid id);

        Task<Thesis> SubmitAsync(Thesis thesis);

        Task<bool> UpdateDetailsAsync(Guid id, Thesis thesis);

        Task<bool> UpdateStatusAsync(Guid id, Thesis updateStatusDto);

        Task<bool> DeleteThesisAsync(Guid id);


    }
}
