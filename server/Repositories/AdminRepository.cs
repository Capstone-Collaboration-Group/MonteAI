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
        public async Task<Admin?> GetAdminByIdAsync(string id)=> await _db.Admins.FindAsync(id);
        

        // CreateAdminAsync
        public async Task<bool> CreateAdminAsync(Admin admin)
        {
            var result = await _db.Admins.FindAsync(admin.Id);
            if (result != null) return false;

            await _db.Admins.AddAsync(admin);

            await _db.SaveChangesAsync();
            return true;
        }

        // UpdateAdminAsync — partial update: only non-null fields are written
        public async Task<bool> UpdateAdminAsync(Admin admin, string id)
        {
            var result = await _db.Admins.FindAsync(id);
            if (result == null) return false;
            // Eww ampangit, needs refactor
            if (admin.Email != null) result.Email = admin.Email;
            if (admin.FirstName != null) result.FirstName = admin.FirstName;
            if (admin.MiddleInitial != null) result.MiddleInitial = admin.MiddleInitial;
            if (admin.LastName != null) result.LastName = admin.LastName;
            if (admin.Suffix != null) result.Suffix = admin.Suffix;
            if (admin.Role != null) result.Role = admin.Role;
            if (admin.Position != null) result.Position = admin.Position;
            if (admin.IsActive != null) result.IsActive = admin.IsActive;
            result.UpdatedAt = admin.UpdatedAt;

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