using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.Entities;
using server.Repositories.Interfaces;

namespace server.Repositories
{
    public class ReviewRepository : IReviewRepository
    {
        private readonly AppDbContext _db;
        
        public ReviewRepository(AppDbContext db)
        {
            _db = db;
        }
        public async Task<IEnumerable<Review>> GetAllReviewsAsync() 
            => await _db.Reviews.ToListAsync();

        public async Task<Review?> GetReviewByIdAsync(Guid id)
             => await _db.Reviews.FindAsync(id);

        public async Task<bool> CreateReviewAsync(Review review)
        {
            var existing = await _db.Reviews.FindAsync(review.Id);
            if (existing != null) return false;

            await _db.Reviews.AddAsync(review);
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> UpdateReviewAsync(Review review)
        {
            var result = await _db.Reviews.FindAsync(review.Id);
            if (result == null) return false;

            _db.Reviews.Update(review);
            await _db.SaveChangesAsync();
            return true;
        }
        public async Task<bool> DeleteReviewAsync(Guid id)
        {
            var result = await _db.Reviews.FindAsync(id);
            if (result == null) return false;

            _db.Reviews.Remove(result);
            await _db.SaveChangesAsync();
            return true;
        }
    }
}
