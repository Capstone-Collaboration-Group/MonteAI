using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.Entities;
using server.Repositories.Interfaces;

namespace server.Repositories
{
    public class SubmissionRepository : ISubmissionRepository
    {
        private readonly AppDbContext _db;
        public SubmissionRepository(AppDbContext db)
        {
            _db = db;
        }

        public async Task<IEnumerable<Submission>> GetAllSubmissionsAsync()
            => await _db.Submissions
                .OrderBy(s => s.SubmittedAt)
                .ToListAsync();
        public async Task<IEnumerable<Submission>> GetSubmissionsByUserIdAsync(string studentNumber, Guid thesisId)
            => await _db.Submissions
                .Include(s => s.Student)
                .Include(t => t.Thesis)
                .Where(s => s.StudentNumber == studentNumber && s.ThesisId == thesisId)
                .OrderBy(o => o.SubmittedAt)
                .ToListAsync();

        public async Task<Submission?> GetSubmissionByIdAsync(Guid submissionId)
            => await _db.Submissions
            .Include(s => s.Student)
            .Include(t => t.Thesis)
            .Where(sI => sI.Id == submissionId)
            .FirstOrDefaultAsync();

        public async Task<Submission?> CreateSubmissionAsync(Submission submission)
        {
            var existing = await _db.Submissions.FindAsync(submission.Id);
            if (existing != null)
                throw new InvalidOperationException($"A Submission with Id: {submission.Id} Already exists");

            submission.SubmittedAt = DateTime.UtcNow;

            await _db.Submissions.AddAsync(submission);
            await _db.SaveChangesAsync();
            return submission;
        }
        public async Task<Submission?> UpdateSubmissionAsync(Submission submission)
        {
            var result = await _db.Submissions.FindAsync(submission.Id);
            if (result == null) return null;

            result.Notes = submission.Notes;
            await _db.SaveChangesAsync();
            return result;
        }

        public async Task<bool> DeleteSubmissionAsync(Guid submissionId)
        {
            var existing = await _db.Submissions.FindAsync(submissionId);
            if (existing == null) return false;

            _db.Submissions.Remove(existing);
            await _db.SaveChangesAsync();
            return true;
        }

    }
}
