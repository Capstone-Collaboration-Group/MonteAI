using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    public class ProgramHead : User
    {
        [Key]
        public int? Id { get; set; }

        public string? Institute { get; set; }

        public string? ProgramHandled { get; set; }


    }
}
