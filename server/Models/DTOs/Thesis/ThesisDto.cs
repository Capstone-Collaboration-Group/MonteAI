using System.ComponentModel.DataAnnotations;

namespace server.Models.DTOs.Thesis
{
    public class SubmitThesisDto
    {
        [Required]
        public IFormFile? File { get; set; } = null;
        [Required]
        [MaxLength(255)]
        
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Abstract { get; set; } = string.Empty;
        public string? FilePath { get; set; }

        [Required]
        public string UploadedById { get; set; } = string.Empty;
    }

    public class UpdateThesisDto
    {
        [MaxLength(255)]
        public string? Title { get; set; }
        public string? Abstract { get; set; }
        public string? FilePath { get; set; }
    }

    public class UpdateThesisStatusDto
    {
        [Required]
        [MaxLength(15)]
        public string Status { get; set; } = string.Empty;
    }

    public class ThesisResponseDto
    {
        public Guid Id { get; set; }
        public string? Title { get; set; }
        /// <summary>
        /// Abstract TEXT for clients. The SQL column stores the Firestore
        /// document ID (legacy rows store raw text) — the service resolves
        /// this field from Firestore before returning (see IThesisAbstractService).
        /// </summary>
        public string? Abstract { get; set; }
        public string FilePath { get; set; } = string.Empty;
        public string UploadedById { get; set; } = string.Empty;
        public string? Status { get; set; }
        public string? PineconeStatus { get; set; }
        public DateTime? SubmittedAt { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public DateTime? RejectedAt { get; set; }
        public DateTime? IndexedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public Guid? GroupId { get; set; }

        //The entity doesn't have this property, it's just populated from fetching the service. 
        public DateTime? ScheduledAt { get; set; }
        public string? ScheduledVenue { get; set; }

        // Institute of the research group's leader — populated from the
        // ResearchGroup.Leader navigation so clients can group/filter by
        // academic program (ICS / IBE / ITE). Null for legacy uploads
        // submitted without a research group.
        public string? Institute { get; set; }

        // Author names resolved from the research group's members
        // (ResearchGroup.Students) with the group leader listed first.
        // Empty for legacy/admin-archived uploads without a group.
        public List<string> Authors { get; set; } = [];

    }
    public class ThesisChunkDto
    {
        public int ChunkIndex { get; set; }
        public string Text { get; set; } = string.Empty;  // maps to Chunk.Text
        public string? Title { get; set; }
        public string? Url { get; set; }
        public string? Authors { get; set; }
        public string? PublicationYear { get; set; }
        public string? Journal { get; set; }
    }

    public class IngestThesisDto
    {
        public Guid ThesisId { get; set; }
        public List<ThesisChunkDto> Chunks { get; set; } = [];
    }
    public class IngestThesisResponseDto
    {
        public Guid ThesisId { get; set;}
        public int VectorCount { get ;set;}
        public string Status { get; set;} = string.Empty;
    }
}
