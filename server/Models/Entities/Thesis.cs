using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace server.Models.Entities
{
    public class Thesis 
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid Id { get; set; }

        [Required]
        [MaxLength(255)]
        public string? Title{ get; set; }

        public ICollection<Submission> Submissions { get; set; } = [];

        // Since the abstract will be stored in the Firestore, this column stores
        // the Firestore document ID that holds the per-version abstract texts
        // (collection: thesis_abstracts, one doc per thesis). Legacy rows still
        // hold the raw abstract text — readers treat non-GUID values as raw text.
        [Required]
        public string? Abstract { get; set; }

        public string FilePath { get; set; } = string.Empty;

        [Required]
        public string UploadedById { get; set; } = string.Empty;

        [Required]
        [MaxLength(15)]
        public string? Status { get; set; } = "Pending";

        public string? PineconeStatus { get; set; } = "None";

        // Staging-blob URL holding the extracted full text while the body
        // ingestion job is queued/running (async full-text pipeline). Set on
        // ingest/full, cleared when the worker finishes; lets startup recovery
        // re-queue interrupted jobs after a server restart. Null otherwise.
        public string? IngestStagingUrl { get; set; }

        public Guid? GroupId { get; set; }
        public ResearchGroup? ResearchGroup { get; set; }

        public DateTime? SubmittedAt { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public DateTime? RejectedAt { get; set; }
        public DateTime? IndexedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
