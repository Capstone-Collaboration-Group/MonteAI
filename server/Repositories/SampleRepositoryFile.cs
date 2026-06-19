using Microsoft.AspNetCore.Http.HttpResults;
using server.Models.Entities;
using server.Repositories.Interface;

/** SUMMARY: 
This file serves as the template guide for creating
data access files, how to inherit, and implement interface
Task methods within
the Repositories directory **/
namespace server.Repositories
{
    public class SampleRepositoryFile : IInterfaceSample
    {

        public async Task<IEnumerable<Student>> GetAllStudents()
        {
            return new List<Student>(); 
            
        }

        public async Task<Student> GetStudent(string id)
        {
            return new Student();
        }

        public async Task CreateAsync(Student student)
        {
            Console.WriteLine("Registered Student Successfully");
        }

        public async Task UpdateAsync(Student student)
        {
            Console.WriteLine("Test Udpate of student successfully");
        }

        public async Task DeleteAsync(string id)
        {
            Console.WriteLine("Test delete of student successfully");
        }


    }
}
