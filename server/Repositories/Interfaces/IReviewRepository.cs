using server.Models.Entities;

namespace server.Repositories.Interfaces
{
    public interface IReviewRepository
    {
        Task<IEnumerable<Review>> GetAllReviewsAsync();

        Task<Review?> GetReviewByIdAsync(Guid id);

        Task<bool> CreateReviewAsync(Review review);

        Task<bool> UpdateReviewAsync(Review review);

        Task<bool> DeleteReviewAsync(Guid id);

    }
}
