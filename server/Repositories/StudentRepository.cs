
using System.Reflection.Metadata.Ecma335;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.Entities;
using server.Repositories.Interfaces;

namespace server.Repositories
{
    public class StudentRepository : IStudentRepository
    {
        // CreateAsync
        // GetByIdAsync
        // GetAllAsync
        // UpdateAsync
        // DeactivateAsync
        private readonly AppDbContext _db;

        public StudentRepository(AppDbContext db)
        {
            _db = db;
        }

        public async Task CreateAsync(Student student)
        {
            await _db.Students.AddAsync(student);
            await _db.SaveChangesAsync();
        }

        public async Task<Student?> GetByIdAsync(string id)
            => await _db.Students.FindAsync(id);

        public async Task<IEnumerable<Student>> GetAllAsync()
            => await _db.Students.ToListAsync();

        public async Task UpdateAsync(Student student)
        {
            _db.Students.Update(student);
            await _db.SaveChangesAsync();
        }

        //public async Task DeactivateAsync(string id, bool isActive)
        //    => await _db.Students
        //        .Where(s => s.Id == id)
        //        .ExecuteUpdateAsync(s => s
        //            .SetProperty(u => u.IsActive, false)
        //            .SetProperty(u => u.UpdatedAt, DateTime.UtcNow));

    }
}
