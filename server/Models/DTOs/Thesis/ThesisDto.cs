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

        // Admin archival uploads only: one author per line (\n-separated).
        // Stored in Firestore beside the abstract — NEVER in the SQL Abstract
        // column — and forwarded to Pinecone as vector metadata.
        public string? Authors { get; set; }

        // Admin archival uploads only: 4-digit publication year, same
        // Firestore + Pinecone treatment as Authors.
        public string? PublicationYear { get; set; }
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

        // Author names. Resolution order: the Firestore "authors" array
        // (admin archival uploads) overwrites the mapped value, which comes
        // from the research group's members (ResearchGroup.Students) with the
        // group leader listed first. Empty when neither source has authors.
        public List<string> Authors { get; set; } = [];

        // Publication year resolved from Firestore for admin archival uploads
        // (null for student submissions and legacy rows).
        public string? PublicationYear { get; set; }

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
