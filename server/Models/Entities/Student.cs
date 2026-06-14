using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    public class Student : User
    {
        [Key]
        public string? StudentNumber { get; set; }
        public int? GroupId { get; set; }

        public virtual ResearchGroup? ResearchGroup { get; set; }

        public string? Position { get; set; }

        public string? Institute { get; set; }

        public string? Program { get; set; }

        public int? YearLevel { get; set; }

        public char Section { get; set; }


    }
}
