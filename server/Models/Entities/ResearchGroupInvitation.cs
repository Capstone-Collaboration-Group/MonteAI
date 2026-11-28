using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace server.Models.Entities
{
    // Two-phase research group membership: the leader sends a Pending
    // invitation and the invitee accepts (or declines) before joining.
    public class ResearchGroupInvitation
    {
        [Key]
        public int Id { get; set; }

        public Guid GroupId { get; set; }

        public string LeaderId { get; set; } = string.Empty;

        public string StudentId { get; set; } = string.Empty;

        public string Status { get; set; } = "Pending";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public ResearchGroup? Group { get; set; }

        public Student? Student { get; set; }
    }
}
