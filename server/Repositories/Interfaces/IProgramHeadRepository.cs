using server.Models.Entities;

namespace server.Repositories.Interfaces
{
    public interface IProgramHeadRepository
    {
        Task<IEnumerable<ProgramHead>> GetAllProgramHeadsAsync();

        Task<ProgramHead?> GetProgramHeadByIdAsync(string id);

        Task<bool> CreateProgramHeadAsync(ProgramHead programHead);

        Task<bool> UpdateProgramHeadAsync(ProgramHead programHead, string id);
        Task<bool> DeleteProgramHeadAsync(string id);
    }
}