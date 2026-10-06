namespace server.Models.DTOs.Thesis
{
    // Everything the proceedings PDF needs about the thesis, its authors and
    // its defense panel — assembled from SQL by IProceedingsRepository. The
    // panelist comments themselves live in Firestore and are read separately.
    public class ProceedingsDataDto
    {
        public Guid ThesisId { get; set; }

        public string? WorkingTitle { get; set; }

        /// <summary>Group members in defense order (leader first), already formatted.</summary>
        public List<ProceedingsMemberDto> Members { get; set; } = [];

        /// <summary>Distinct programs of <see cref="Members"/>, e.g. "BS Information Technology".</summary>
        public List<string> Programs { get; set; } = [];

        public string? AdviserId { get; set; }

        public string? AdviserName { get; set; }

        /// <summary>Panelists of the group's latest defense schedule (Chairman first).</summary>
        public List<ProceedingsPanelistDto> Panelists { get; set; } = [];

        /// <summary>Thesis version ids — annotations are stored per version in Firestore.</summary>
        public List<Guid> VersionIds { get; set; } = [];
    }

    public class ProceedingsMemberDto
    {
        public string Name { get; set; } = string.Empty;
    }

    public class ProceedingsPanelistDto
    {
        /// <summary>Firebase UID — matches Annotation.reviewerId.</summary>
        public string Id { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;

        public string Role { get; set; } = "Member";
    }
}
