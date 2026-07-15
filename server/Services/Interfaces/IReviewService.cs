using server.Models.DTOs.Review;

namespace server.Services.Interfaces
{
    public interface IReviewService
    {
        Task<IEnumerable<ReviewResponseDto>> GetAllAsync();
        Task<ReviewResponseDto?> GetByIdAsync(Guid id);
        Task<bool> CreateAsync(CreateReviewDto createDto);

        Task<bool> UpdateAsync(UpdateReviewDto updateDto, Guid id);

        Task<bool> DeleteAsync(Guid id);
    }
}
