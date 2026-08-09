using Microsoft.AspNetCore.Mvc;
using server.Models.DTOs.ChatMessage;
using server.Models.DTOs.ChatSession;
using server.Services.Interfaces;

namespace server.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class ChatController : ControllerBase
    {
        private readonly IChatSessionService _chatSessionService;
        private readonly IChatMessageService _chatMessageService;
        private readonly ILogger<ChatController> _logger;
        private readonly IMonteAiResponseService _monteAiResponseService;

        public ChatController(
            IChatSessionService chatSessionService,
            IChatMessageService chatMessageService,
            ILogger<ChatController> logger,
            IMonteAiResponseService monteAiResponseService)
        {
            _chatSessionService = chatSessionService;
            _chatMessageService = chatMessageService;
            _logger = logger;
            _monteAiResponseService = monteAiResponseService;
        }

        [HttpGet("sessions")]
        public async Task<IActionResult> GetAllChats([FromQuery] string userId)
        {
            if (string.IsNullOrWhiteSpace(userId)) return BadRequest("userId parameter is required.");

            var result = await _chatSessionService.GetAllAsync(userId);
            if (result == null) return NotFound("No Chat Sessions Found");

            _logger.LogInformation("Fetched {Count} chat sessions for user {UserId}", result.Count(), userId);
            return Ok(new { Message = "Fetched all chat Sessions", result });
        }

        [HttpGet("sessions/{id}")]
        public async Task<IActionResult> GetChatById([FromRoute] Guid id)
        {
            var result = await _chatSessionService.GetByIdAsync(id);
            if (result == null) return NotFound($"No Chat Session with Id: {id} Found");

            _logger.LogInformation("Fetched Chat ID: {Id}", id);
            return Ok(result);
        }

        [HttpPost("sessions/create")]
        public async Task<IActionResult> CreateChatSession([FromBody] CreateChatSessionDto dto)
        {
            var result = await _chatSessionService.CreateAsync(dto);
            _logger.LogInformation("Created session result: {Result}", result);
            return Ok(new { Message = "Session created", result });
        }

        [HttpPost("sessions/{id}/messages")]
        public async Task<IActionResult> SendChatMessage([FromRoute] string id, [FromBody] CreateChatMessageDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto?.Content))
            {
                return BadRequest(new { Message = "Message content cannot be empty." });
            }

            // 1. Persist the user's incoming message
            var userMessage = await _chatMessageService.CreateAsync(dto, id);
            if (userMessage == null)
            {
                return StatusCode(500, new { Message = "Failed to persist user message." });
            }

            // 2. Generate RAG response via Phi-4 + Pinecone
            string aiReplyText;
            try
            {
                aiReplyText = await _monteAiResponseService.GenerateResponseAsync(dto.Content);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "MonteAI response generation failed for session {SessionId}", id);
                return StatusCode(500, new { Message = "MonteAI could not generate a response. Please try again." });
            }

            // 3. Persist the AI's generated response
            var aiMessageDto = new CreateChatMessageDto
            {
                Content = aiReplyText,
                Role = "assistant",
            };

            var aiMessage = await _chatMessageService.CreateAsync(aiMessageDto, id);
            if (aiMessage == null)
            {
                _logger.LogWarning("MonteAI generated a response but failed to persist for session {SessionId}", id);

                // Return response text so client UI doesn't break, but flag persistence failure in log
                return Ok(new { Message = "Message generated but failed to persist AI response", userMessage, aiMessage = aiMessageDto });
            }

            return Ok(new { Message = "Message successfully stored", userMessage, aiMessage });
        }

        [HttpPut("sessions/{id}/update")]
        public async Task<IActionResult> UpdateChatSessionTitle([FromRoute] Guid id, [FromBody] UpdateChatSessionDto updateDto)
        {
            var result = await _chatSessionService.UpdateAsync(updateDto, id);
            if (!result) return StatusCode(500, new { Message = "Failed to update chat session title." });

            return Ok(new { Message = "Chat Session Title Updated" });
        }

        [HttpDelete("sessions/{id}/delete")] // Fixed leading slash issue
        public async Task<IActionResult> DeleteChatSession([FromRoute] Guid id)
        {
            var success = await _chatSessionService.DeleteAsync(id);
            if (!success) return StatusCode(500, new { Message = "Failed to delete chat session." });

            return Ok(new { Message = "Chat Session Deleted" });
        }
    }
}