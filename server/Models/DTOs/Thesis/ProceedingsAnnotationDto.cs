namespace server.Models.DTOs.Thesis
{
    // One panelist comment read back from Firestore for the proceedings PDF —
    // a projection of the annotation document written by the PDF viewer.
    public class ProceedingsAnnotationDto
    {
        /// <summary>Firebase UID of the panelist who commented.</summary>
        public string ReviewerId { get; set; } = string.Empty;

        public string Comment { get; set; } = string.Empty;

        public bool IsResolved { get; set; }

        public string? ResolverNote { get; set; }

        public int PageNumber { get; set; } = 1;

        /// <summary>ISO-8601 timestamp — the documents store it as a string.</summary>
        public string CreatedAt { get; set; } = string.Empty;
    }
}
