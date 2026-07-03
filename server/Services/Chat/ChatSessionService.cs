using AutoMapper;
using Microsoft.AspNetCore.Components.Web;
using server.Models.DTOs.ChatSession;
using server.Models.Entities;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

namespace server.Services.Chat
{
    public class ChatSessionService : IChatSessionService
    {
        private readonly IChatSessionRepository _repo;
        private readonly ILogger<ChatSessionService> _logger;
        private readonly IMapper _mapper;

        public ChatSessionService(IChatSessionRepository repo, ILogger<ChatSessionService> logger, IMapper mapper)
        {
            _repo = repo;
            _logger = logger;
            _mapper = mapper;
        }

        public async Task<IEnumerable<ChatSessionResponseDto>> GetAllAsync(string userId)
        {
            var result = await _repo.GetAllChatSessionsAsync(userId);

            var dtos =  _mapper.Map<IEnumerable<ChatSessionResponseDto>>(result);

            _logger.LogInformation("All User ChatSessions Fetched");

            return dtos;
        }

        // GetByIdAsync 
        public async Task<ChatSessionResponseDto?> GetByIdAsync(Guid id)
        {
            var result = await _repo.GetChatSessionByIdAsync(id);

            var dto = _mapper.Map<ChatSessionResponseDto?>(result);

            _logger.LogInformation("Chat Session {id} has been successfully fetched", id);

            return dto;
        }

        // CreateAsync
        public async Task<ChatSessionResponseDto> CreateAsync(CreateChatSessionDto createChatSessionDto)
        {
            var chatSession = _mapper.Map<ChatSession>(createChatSessionDto);

            chatSession.CreatedAt = DateTime.UtcNow;
            chatSession.LastChatDate = DateTime.UtcNow;

            var result = await _repo.CreateChatSessionAsync(chatSession);
            _logger.LogInformation("ChatSession Created with result: {result}", result);

            return _mapper.Map<ChatSessionResponseDto>(chatSession);
        }

        public async Task<bool> UpdateAsync(UpdateChatSessionDto updateChatSessionDto)
        {
            var chatSession = _mapper.Map<ChatSession>(updateChatSessionDto);
            chatSession.LastChatDate = DateTime.UtcNow;
            var result = await _repo.UpdateChatSessionAsync(chatSession);

            return result;
        }

        public async Task<bool> DeleteAsync(Guid id)
        {
            var result = await _repo.DeleteChatSessionAsync(id);
            _logger.LogInformation("Chat Session With Id: {Id} Is deleted", id);
            return result;
        }



    }
}