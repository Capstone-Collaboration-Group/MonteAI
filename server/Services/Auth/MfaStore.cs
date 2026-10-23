using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Services.Interfaces;
using UserEntity = server.Models.Entities.User;

namespace server.Services.Auth
{
    public class MfaStore : IMfaStore
    {
        private readonly AppDbContext _db;

        public MfaStore(AppDbContext db)
        {
            _db = db;
        }

        public async Task<UserEntity?> FindUserAsync(string uid)
        {
            // AsNoTracking-free so mutations made by the caller are saved.
            return (UserEntity?)await _db.Students.FindAsync(uid)
                ?? (UserEntity?)await _db.Faculties.FindAsync(uid)
                ?? (UserEntity?)await _db.ProgramHeads.FindAsync(uid)
                ?? (UserEntity?)await _db.Admins.FindAsync(uid);
        }

        public Task SaveAsync() => _db.SaveChangesAsync();
    }
}
