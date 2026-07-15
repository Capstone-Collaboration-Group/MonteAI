using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.Entities;
using server.Repositories.Interfaces;

namespace server.Repositories
{
    public class ChatSessionRepository : IChatSessionRepository
    {
        private readonly AppDbContext _db;

        public ChatSessionRepository(AppDbContext db)
        {
            _db = db;
        }

        public async Task<IEnumerable<ChatSession>> GetAllChatSessionsAsync(string userId) 
            => await _db.ChatSessions
                .Where(cs => cs.UserId == userId)
                .ToListAsync();

        public async Task<ChatSession?> GetChatSessionByIdAsync(Guid id) => await _db.ChatSessions.FindAsync(id);

        public async Task<bool> CreateChatSessionAsync(ChatSession chatSession)
        {
            await _db.ChatSessions.AddAsync(chatSession);
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> UpdateChatSessionAsync(ChatSession chatSession)
        {
            Console.WriteLine(chatSession.Id);
            Console.WriteLine(chatSession.Title);
            var existing = await _db.ChatSessions.FindAsync(chatSession.Id);
            
            if (existing == null) return false;
            Console.WriteLine(existing.ToString());

            existing.Title = chatSession.Title;
            existing.LastChatDate = chatSession.LastChatDate;

            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteChatSessionAsync(Guid id)
        {
            var result = await _db.ChatSessions.FindAsync(id);
            if (result == null) return false;

            _db.ChatSessions.Remove(result);
            await _db.SaveChangesAsync();
            return true;
        }
    }
}
