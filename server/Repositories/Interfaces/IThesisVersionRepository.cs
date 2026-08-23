using server.Models.Entities;

namespace server.Repositories.Interfaces
{
    public interface IThesisVersionRepository
    {
        Task<IEnumerable<ThesisVersion>> GetVersionsByThesisId(Guid thesisId);

        Task<ThesisVersion?> GetVersionById(Guid versionId);
        Task<ThesisVersion?> GetLatestVersion(Guid thesisId);
        Task<int> GetNextVersionNumber(Guid thesisId);
        Task<bool> CreateThesisVersion(ThesisVersion thesisVersion);
        Task<bool> DeleteThesisVersion(Guid versionId);
    }
}