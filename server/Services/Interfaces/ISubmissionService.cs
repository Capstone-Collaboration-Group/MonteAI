using server.Models.DTOs.Submission;

namespace server.Services.Interfaces
{
    public interface ISubmissionService
    {
        Task<IEnumerable<SubmissionResponseDto>> GetAllAsync();

        Task<IEnumerable<SubmissionResponseDto>> GetAllByUserIdAsync(string studentNumber, Guid ThesisId);

        Task<SubmissionResponseDto?> GetByIdAsync(Guid submissionId);

        Task<SubmissionResponseDto?> CreateAsync(CreateSubmissionDto dto);

        Task<SubmissionResponseDto?> UpdateAsync(UpdateSubmissionDto dto, Guid submissionId);

        Task<bool> DeleteAsync(Guid submissionId);
    }
}
