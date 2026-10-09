using System.ComponentModel.DataAnnotations;
using Google.Cloud.Firestore;

// server/Models/Entities/ChatMessage.cs
//
// Firestore-persisted chat message.
//
// Layout: chat_sessions/{sessionId}/messages/{messageId}
//
// SourcesJson stores the serialized List&lt;ChatSourceDto&gt; for assistant
// messages, so the citation panel survives session reloads. Older documents
// simply lack the field and deserialize as null.

namespace server.Models.Entities
{
    [FirestoreData]
    public class ChatMessage
    {
        [Required]
        [FirestoreDocumentId]
        public string Id { get; set; } = string.Empty;

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

        /// <summary>JSON-serialized List&lt;ChatSourceDto&gt; — the provenance of an assistant answer.</summary>
        [FirestoreProperty]
        public string? SourcesJson { get; set; }
    }
}
