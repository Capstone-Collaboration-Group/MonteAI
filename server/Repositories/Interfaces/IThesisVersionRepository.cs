using server.Models.Entities;

namespace server.Repositories.Interfaces
{
    public interface IThesisVersionRepository
    {
        Task<IEnumerable<ThesisVersion>> GetVersionsByThesisId(Guid thesisId);

        Task<ThesisVersion?> GetByIdAsync(Guid versionId);
        Task<ThesisVersion?> GetLatestThesisIdAsync(Guid thesisId);
        Task<int> GetNextVersionNumber(Guid thesisId);
        Task<bool> CreateThesisVersion(ThesisVersion thesisVersion);
        Task<bool> DeleteAllExceptLatestAsync(Guid thesisId);
    }
}