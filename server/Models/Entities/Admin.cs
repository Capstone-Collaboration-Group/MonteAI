using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    public class Admin : User
    {
        [Key]
        public string? Uid { get; set; }

        public string? Position { get; set; }

    }
}
