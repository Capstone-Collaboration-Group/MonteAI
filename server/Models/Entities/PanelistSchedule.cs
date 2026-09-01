using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Runtime.Serialization;
using System.Text.Json.Serialization;

namespace server.Models.Entities
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum PanelistType
    {
        [EnumMember(Value =("faculty"))]
        Faculty,
        [EnumMember(Value =("program-head"))]
        ProgramHead,
        [EnumMember(Value =("admin"))]
        Admin
    }
    public class PanelistSchedule
    {
        public Guid ScheduleId { get; set; }
        public Schedule? Schedule { get; set;}

        [MaxLength(128)]
        public string PanelistId { get; set; } = string.Empty;
        [Required]
        public PanelistType? PanelistType { get; set; }

        [MaxLength(50)]
        public string? Role { get; set;}
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    }
}
