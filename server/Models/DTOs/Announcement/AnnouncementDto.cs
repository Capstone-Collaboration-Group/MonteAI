using System.ComponentModel.DataAnnotations;
using Microsoft.Identity.Client;
using server.Models.Entities;

namespace server.Models.DTOs.Announcement
{
    public class AnnouncementResponseDto
    {
        public Guid Id { get; set; }

        [Required]
        public string Subject { get; set; } = string.Empty;
        [Required]
        public string Content { get; set; } = string.Empty;

        public List<string> AttachmentUrls { get; set; } = new();

        public DateTime? CreatedAt { get; set; }

        public DateTime? LastModified { get; set; }

        public AnnouncementAuthorDto Author { get; set; } = new();

    }
    
    public class AnnouncementAuthorDto
    {
        public string Id { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;

        public string Role { get; set; } = string.Empty;
    }
    public class CreateAnnouncementDto
    {
        [Required]
        public string Subject { get; set; } = string.Empty;
        [Required]
        public string Content { get; set; } = string.Empty;

        public List<string> AttachmentUrls { get; set; } = new();

        public DateTime? CreatedAt { get; set; }

        public DateTime? LastModified { get; set; }
    }
    public class UpdateAnnouncementDto
    {
        [Required]
        public string Subject { get; set; } = string.Empty;

        [Required]
        public string Content { get; set; } = string.Empty;

        public List<string> AttachmentUrls { get; set; } = new(); 

        public DateTime? LastModified { get; set; }
    }
}
