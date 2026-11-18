namespace server.Models.DTOs.Thesis
{
    // Everything the proceedings PDF needs about the thesis, its authors and
    // its defense panel — assembled from SQL by IProceedingsRepository. The
    // panelist comments themselves live in Firestore and are read separately.
    public class ProceedingsDataDto
    {
        public Guid ThesisId { get; set; }

        public string? WorkingTitle { get; set; }

        public DateOnly? DefenseDate { get; set; }

        /// <summary>Start of the group's latest defense schedule.</summary>
        public TimeOnly? StartTime { get; set; }

        /// <summary>End of the group's latest defense schedule.</summary>
        public TimeOnly? EndingTime { get; set; }

        /// <summary>Room/venue of the latest defense schedule.</summary>
        public string? RoomVenue { get; set; }

        /// <summary>
        /// Section / Year Level shared by the group, e.g. "3-A" — derived from
        /// <c>Student.Section</c> + <c>Student.YearLevel</c> (blank when mixed).
        /// </summary>
        public string? SectionYearLevel { get; set; }

        /// <summary>Group members in defense order (leader first), already formatted.</summary>
        public List<ProceedingsMemberDto> Members { get; set; } = [];

        /// <summary>Distinct programs of <see cref="Members"/>, e.g. "BS Information Technology".</summary>
        public List<string> Programs { get; set; } = [];

        public string? AdviserId { get; set; }

        public string? AdviserName { get; set; }

        /// <summary>Panelists of the group's latest defense schedule (Chairman first).</summary>
        public List<ProceedingsPanelistDto> Panelists { get; set; } = [];

        /// <summary>The latest thesis version id; proceedings include its annotations only.</summary>
        public List<Guid> VersionIds { get; set; } = [];
    }

    public class ProceedingsMemberDto
    {
        public string Name { get; set; } = string.Empty;

        /// <summary>"Dela Cruz, Juan" — the Section X acknowledgment format.</summary>
        public string LastFirst { get; set; } = string.Empty;

        /// <summary>Last name, lower-cased — A–Z ordering for Section X.</summary>
        public string SortKey { get; set; } = string.Empty;
    }

    /// <summary>Body of POST /thesis/{id}/proceedings — records who generated the PDF.</summary>
    public class GenerateProceedingsDto
    {
        /// <summary>Panel Chairperson | Panel Member | Capstone Adviser.</summary>
        public string? Role { get; set; }
    }

    public class ProceedingsPanelistDto
    {
        /// <summary>Firebase UID — matches Annotation.reviewerId.</summary>
        public string Id { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;

        public string Role { get; set; } = "Member";
    }
}
