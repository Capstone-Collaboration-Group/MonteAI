
namespace server.Models.Entities
{
    public abstract class User
    {
        public string? Email { get; set;  }

        public string? FirstName { get; set; }

        public string? MiddleInitial { get; set; }
        public string? LastName { get; set; }

        public string? Role { get; set; }
        public bool? IsActive { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }
    }
}