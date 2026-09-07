using server.Models.Entities;

namespace server.Repositories.Interfaces
{
    public interface IStudentRepository
    {
        Task CreateAsync(Student student);
        Task<Student?> GetByIdAsync(string id);
        Task<Student?> GetByStudentNumberAsync(string studentNumber);

        Task<IEnumerable<Student>> GetAllAsync();

        Task UpdateAsync(Student student);



        //Task DeleteAsync(string id);
    }
}
