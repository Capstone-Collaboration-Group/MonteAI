using Google.Cloud.Firestore;
using server.Models.Entities;

namespace server.Repositories
{
    public interface IChatMessageRepository
    {
        Task<List<ChatMessage>> GetMessagesBySessionIdAsync(Guid id);

        Task<ChatMessage> CreateChatMessageAsync(ChatMessage chatMessage);

        Task DeleteMessagesBySessionIdAsync(Guid id);
    }
    public class ChatMessageRepository : IChatMessageRepository
    {
        private readonly FirestoreDb _firestore;
        public ChatMessageRepository(FirestoreDb firestore)
        {
            _firestore = firestore;
        }
        // Get Chat Messages by ChatSession Id
        public async Task<List<ChatMessage>> GetMessagesBySessionIdAsync(Guid sessionId)
        {
            var snapshot = await _firestore
                .Collection("chat_sessions")
                .Document(sessionId.ToString())
                .Collection("messages")
                .OrderByDescending("timestamp")
                .GetSnapshotAsync();
            
                return snapshot.Documents
                .Select(d => d.ConvertTo<ChatMessage>())
                .ToList();
        }
        public async Task<ChatMessage> CreateChatMessageAsync(ChatMessage chatMessage)
        {
            // Dito macreate yung timestamp, chatmessage id, at document reference;
            var docRef = _firestore
                .Collection("chat_sessions")
                .Document(chatMessage.SessionId.ToString())
                .Collection("messages")
                .Document();

            chatMessage.Id = docRef.Id;
            chatMessage.Timestamp = DateTime.UtcNow;
            await docRef.SetAsync(chatMessage);

            return chatMessage;
        }

        public async Task DeleteMessagesBySessionIdAsync(Guid sessionId)
        {
            var messages = _firestore
                .Collection("chat_sessions")
                .Document(sessionId.ToString())
                .Collection("messages");
            var snapshot = await messages.GetSnapshotAsync();

            foreach (var batchDocuments in snapshot.Documents.Chunk(500))
            {
                var batch = _firestore.StartBatch();
                foreach (var document in batchDocuments)
                {
                    batch.Delete(document.Reference);
                }

                await batch.CommitAsync();
            }

            await _firestore
                .Collection("chat_sessions")
                .Document(sessionId.ToString())
                .DeleteAsync();
        }
    }
}
