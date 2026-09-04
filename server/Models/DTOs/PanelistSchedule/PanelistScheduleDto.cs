using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using server.Models.Entities;

namespace server.Models.DTOs.PanelistSchedule
{
     public class CreatePanelistScheduleDto
    {
        [Required]
        public Guid ScheduleId { get; set; }

        [Required]
        public string PanelistId { get; set; } = string.Empty;

        [Required]
        public PanelistType PanelistType { get; set; }
    }

    public class UpdatePanelistScheduleDto
    {
        public PanelistType PanelistType { get; set; }
    }

    public class PanelistScheduleResponseDto
    {
        public Guid ScheduleId { get; set; }

        public string PanelistId { get; set; } = string.Empty;

        public PanelistType PanelistType { get; set; }
    }

    // Enriched read model used by the panelist management UI: one entry per panelist
    // person (Faculty / ProgramHead / Admin) carrying their identity data plus every
    // defense schedule they are assigned to.
    public class PanelistResponseDto
    {
        public string Id { get; set; } = string.Empty;

        public string Email { get; set; } = string.Empty;

        public string FirstName { get; set; } = string.Empty;

        public char? MiddleInitial { get; set; }

        public string LastName { get; set; } = string.Empty;

        public string? Suffix { get; set; }

        public string Role { get; set; } = string.Empty;

        public string? Institute { get; set; }

        public string? Position { get; set; }

        public PanelistType PanelistType { get; set; }

        public bool? IsActive { get; set; }

        public List<PanelistAssignmentSummaryDto> Assignments { get; set; } = [];

        public bool IsAssigned { get; set; }
    }

    public class PanelistAssignmentSummaryDto
    {
        public Guid ScheduleId { get; set; }

        public string GroupName { get; set; } = string.Empty;

        public DateOnly Date { get; set; }

        public TimeOnly StartTime { get; set; }

        public TimeOnly EndingTime { get; set; }
    }

}