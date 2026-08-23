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

        //[Required]
        public string FilePath { get; set; } = string.Empty;

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
