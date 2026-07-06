using AutoMapper;
using server.Models.DTOs.ChatMessage;
using server.Models.Entities;
using server.Repositories;
using server.Services.Interfaces;

namespace server.Services.Chat
{
    public class ChatMessageService : IChatMessageService
    {
        private readonly IChatMessageRepository _repo;
        private readonly ILogger<ChatMessageService> _logger;
        private readonly IMapper _mapper;

        public ChatMessageService(IChatMessageRepository repo, ILogger<ChatMessageService> logger, IMapper mapper)
        {
            _repo = repo;
            _logger = logger;
            _mapper = mapper;
        }
        public async Task<ChatMessageResponseDto> CreateAsync(CreateChatMessageDto dto, string sessionId)
        {
            var chatMessage = _mapper.Map<ChatMessage>(dto);
            chatMessage.SessionId = sessionId;
            var result = await _repo.CreateChatMessageAsync(chatMessage);

            _logger.LogInformation("Chat Message with ID: {Id} created", result.Id);

            return _mapper.Map<ChatMessageResponseDto>(result);

        }
    }
}
