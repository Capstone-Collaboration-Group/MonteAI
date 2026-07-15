using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.Entities;
using server.Repositories.Interfaces;

namespace server.Repositories
{
    public class AdminRepository : IAdminRepository
    {
        private readonly AppDbContext _db;

        public AdminRepository(AppDbContext db)
        {
            _db = db;
        }

        // GetAllAdminAsync
        public async Task<IEnumerable<Admin>> GetAllAdminsAsync() => await _db.Admins.ToListAsync();

        // GetAdminByIdAsync
        public async Task<Admin?> GetAdminByIdAsync(string id) => await _db.Admins.FindAsync(id);

        // CreateAdminAsync
        public async Task<bool> CreateAdminAsync(Admin admin)
        {
            var result = await _db.Admins.FindAsync(admin.Id);
            if (result != null) return false;

            await _db.Admins.AddAsync(admin);

            await _db.SaveChangesAsync();
            return true;
        }

        // UpdateAdminAsync
        public async Task<bool> UpdateAdminAsync(Admin admin)
        {
            var result = await _db.Admins.FindAsync(admin.Id);
            if (result == null) return false;
            _db.Admins.Update(admin);
            await _db.SaveChangesAsync();
            return true;
        }

        // DeleteAdminAsync 
        public async Task<bool> DeleteAdminAsync(string id)
        {
            var result = await _db.Admins.FindAsync(id);
            if (result == null) return false;
            _db.Admins.Remove(result);
            await _db.SaveChangesAsync();
            return true;
        }
    }
}