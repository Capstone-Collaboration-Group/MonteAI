using server.Models.Entities;

namespace server.Repositories.Interfaces
{
    public interface IResearchGroupRepository
    {
        Task<IEnumerable<ResearchGroup>> GetAllResearchGroupsAsync();

        Task<ResearchGroup?> GetResearchGroupByIdAsync(Guid id);

        Task<bool> CreateResearchGroupAsync(ResearchGroup researchGroup);

        Task<bool> UpdateResearchGroupAsync(ResearchGroup researchGrup);

        Task<bool> DeleteResearchGroupAsync(Guid id);
    }
}
