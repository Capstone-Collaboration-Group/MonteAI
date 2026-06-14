using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    public class Faculty : User
    {
        [Key]
        public string? Uid { get; set; }
    }
}
