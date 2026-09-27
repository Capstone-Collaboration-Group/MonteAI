using server.Models.DTOs.Thesis;
using server.Models.Entities;

// server/Repositories/Interfaces/IThesisRepository.cs
//
// Data access contract for the Azure SQL Theses table.

namespace server.Repositories.Interfaces
{
    public interface IThesisRepository
    {
        /// <param name="program">Optional academic-program filter (ICS / IBE /
        /// ITE). Matched case-insensitively against the research group leader's
        /// institute via keyword; null / unknown returns unfiltered.</param>
        Task<IEnumerable<Thesis>> GetFirst20ThesisAsync(string? program = null);

        Task<Thesis?> GetThesisByIdAsync(Guid id);

        /// <summary>
        /// Exact-match (LIKE) search over thesis titles and abstracts — the
        /// keyword half of the agent's hybrid retrieval. Used by the
        /// keyword_search tool for acronyms and exact terms that dense
        /// embeddings tend to miss.
        /// </summary>
        Task<IReadOnlyList<Thesis>> SearchByKeywordAsync(string term, int limit, CancellationToken cancellationToken = default);

        Task<Thesis> SubmitAsync(Thesis thesis);

        Task<bool> ExistsByGroupIdAsync(Guid groupId);

        Task<bool> UpdateDetailsAsync(Guid id, Thesis thesis);

        Task<bool> UpdateStatusAsync(Guid id, Thesis updateStatusDto);

        Task<bool> DeleteThesisAsync(Guid id);


    }
}
