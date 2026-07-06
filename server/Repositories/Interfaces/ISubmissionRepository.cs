using server.Models.Entities;

namespace server.Repositories.Interfaces
{
    public interface ISubmissionRepository
    {
        Task<IEnumerable<Submission>> GetAllSubmissionsAsync();

        Task<IEnumerable<Submission>> GetSubmissionsByUserIdAsync(string studentNumber, Guid thesisId);

        Task<Submission?> GetSubmissionByIdAsync(Guid id);

        Task<Submission?> CreateSubmissionAsync(Submission submission);

        Task<Submission?> UpdateSubmissionAsync(Submission submission);

        Task<bool> DeleteSubmissionAsync(Guid id);


    }
}
