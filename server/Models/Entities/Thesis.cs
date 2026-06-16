using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    public class Thesis 
    {
        [Key]
        public string? Id { get; set; }

        [Required]
        [MaxLength(255)]
        public string? Title{ get; set; }
        [Required]
        public List<Student>? Authors { get; set; }

        [Required]
        public string? Abstract { get; set; }

        [Required]
        public string? FilePath { get; set; }

        [Required]
        public string? UploadedById { get; set; }

        [Required]
        [MaxLength(100)]
        public string? Status { get; set; }
        
        public string? PineconeStatus { get; set; }

        public DateTime? SubmittedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }


    }
}
