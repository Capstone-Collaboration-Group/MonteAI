using AutoMapper;
using server.Models.Agent;
using server.Models.DTOs.ChatMessage;
using server.Models.Entities;
using server.Repositories;
using server.Services.Interfaces;
using System.Text.Json;

// server/Services/Chat/ChatMessageService.cs
//
// Persists chat messages to Firestore and loads conversation history.
//
// Sources flow: the agent produces List<ChatSourceDto> -> serialized to JSON
// here -> stored on the Firestore document (SourcesJson) -> returned on the
// DTO so the UI can render citations immediately AND on later session loads.

namespace server.Services.Chat
{
    public class ChatMessageService : IChatMessageService
    {
        private static readonly JsonSerializerOptions SourceJsonOptions = new(JsonSerializerDefaults.Web);

        private readonly IChatMessageRepository _repo;
        private readonly ILogger<ChatMessageService> _logger;
        private readonly IMapper _mapper;

        public ChatMessageService(IChatMessageRepository repo, ILogger<ChatMessageService> logger, IMapper mapper)
        {
            _repo = repo;
            _logger = logger;
            _mapper = mapper;
        }

        public async Task<ChatMessageResponseDto> CreateAsync(
            CreateChatMessageDto dto,
            string sessionId,
            IReadOnlyList<ChatSourceDto>? sources = null)
        {
            var chatMessage = _mapper.Map<ChatMessage>(dto);
            chatMessage.SessionId = sessionId;
            chatMessage.SourcesJson = sources is { Count: > 0 }
                ? JsonSerializer.Serialize(sources, SourceJsonOptions)
                : null;

            var result = await _repo.CreateChatMessageAsync(chatMessage);

            _logger.LogInformation("Chat Message with ID: {Id} created", result.Id);

            var response = _mapper.Map<ChatMessageResponseDto>(result);
            response.Sources = sources is { Count: > 0 } ? sources.ToList() : null;
            return response;
        }

        public async Task<IReadOnlyList<ConversationTurn>> GetHistoryAsync(Guid sessionId, int maxTurns = 10)
        {
            // Repository returns newest-first; reverse into chronological order
            // and keep only the last maxTurns turns.
            var messages = await _repo.GetMessagesBySessionIdAsync(sessionId);
            var chronological = messages.AsEnumerable().Reverse().ToList();

            if (chronological.Count > maxTurns)
            {
                chronological = chronological.Skip(chronological.Count - maxTurns).ToList();
            }

            return chronological
                .Select(m => new ConversationTurn(m.Role ?? "user", m.Content ?? string.Empty))
                .ToList();
        }
    }
}
