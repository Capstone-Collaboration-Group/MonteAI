using System.ComponentModel.DataAnnotations;
using Google.Cloud.Firestore;

namespace server.Models.Entities
{
    // will be stored in Firestore 
    [FirestoreData]
    public class ChatMessage
    {
        [Required]
        [FirestoreDocumentId]
        public string Id { get; set; } =string.Empty;
        [FirestoreProperty]
        public string SessionId { get; set; } = string.Empty;

        [Required]
        [FirestoreProperty("role")]
        public string? Role { get; set; } = string.Empty;

        [Required]
        [FirestoreProperty("content")]
        public string? Content { get; set; } = string.Empty;
        [FirestoreProperty("timestamp")]
        public DateTime? Timestamp { get; set; }
    }
}
