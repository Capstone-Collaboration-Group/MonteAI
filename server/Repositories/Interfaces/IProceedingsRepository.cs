using server.Models.DTOs.Thesis;

namespace server.Repositories.Interfaces
{
    public interface IProceedingsRepository
    {
        /// <summary>Thesis + group + panel data for the proceedings PDF, or null when the thesis does not exist.</summary>
        Task<ProceedingsDataDto?> GetProceedingsDataAsync(Guid thesisId);

        /// <summary>Firebase UID → "First M. Last" for the given ids (students, faculty, program heads, admins).</summary>
        Task<IReadOnlyDictionary<string, string>> GetDisplayNamesAsync(IEnumerable<string> userIds);
    }
}
