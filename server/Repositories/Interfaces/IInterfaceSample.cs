using System;

using server.Models.Entities;

/** 
 * SUMMARY 
 * This interface file serves as the template guide 
 * for creating interfaces which will be inherited by
 * repository files
 * **/
namespace server.Repositories.Interface
{
    public interface IInterfaceSample
    {
        // create Task methods

        Task<IEnumerable<Student>> GetAllStudents();

        Task<Student> GetStudent(string id);
        Task CreateAsync(Student student);
        Task DeleteAsync(string id);

        Task UpdateAsync(Student student);
    }
}
