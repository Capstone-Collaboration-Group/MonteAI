using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace server.Models.DTOs.Thesis
{
    public class ThesisVersionResponseDto
    {
        public Guid Id { get; set; }

        public Guid ThesisId { get; set; }

        public int VersionNumber { get; set; }

        public string FilePath { get; set; } = string.Empty;

        public string UploadedById { get; set; } = string.Empty;
        public DateTime UploadedAt { get; set; }

        public string? ChangeNote { get; set; } = string.Empty;

 
    }

    public class CreateThesisVersionDto
    {
        [Required]
        public Guid ThesisId { get; set; }

        public IFormFile? File { get; set; }

        [MaxLength(2048)]
        [JsonIgnore]
        public string FilePath { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? ChangeNote { get; set; }

        /// <summary>
        /// Optional revised abstract for this version — stored in Firestore
        /// under the new version number (see IThesisAbstractService). When
        /// omitted, previous abstracts remain the latest for display.
        /// </summary>
        public string? Abstract { get; set; }
    }

    public class UpdateThesisVersionDto
    {
        [MaxLength(500)]
        public string? ChangeNote { get; set; }

        [MaxLength(2048)]
        public string? FilePath { get; set; }
    }

}
