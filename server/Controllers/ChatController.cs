using Microsoft.AspNetCore.Mvc;
using server.Models.DTOs.ChatMessage;
using server.Models.DTOs.ChatSession;
using server.Services.Interfaces;

/**
 * Summary: 
 * Api controller for Chat Messages
 * Working on sending and receiving responses to the data layer
 * Just needed to implement AI chat feature on the client (Expo) with 
 * Gemma 4 as the LLM
 */

namespace server.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class ChatController : ControllerBase
    {
        private readonly IChatSessionService _chatSessionService;
        private readonly IChatMessageService _chatMessageService;
        private readonly ILogger<ChatController> _logger;

        public ChatController(IChatSessionService chatSessionService, IChatMessageService chatMessageService,  ILogger<ChatController> logger)
        {
            _chatSessionService = chatSessionService;
            _chatMessageService = chatMessageService;
            _logger = logger;
        }
        [HttpGet("sessions")]
        public async Task<IActionResult> GetAllChats(string userId)
        {
            var result = await _chatSessionService.GetAllAsync(userId);

            if (result == null) return NotFound("No Chat Sessions Found");
            _logger.LogInformation("Fetched {number}", result.Count());

            return Ok(new { Message = "Fetched all chat Sessions", result});
        }
        [HttpGet("sessions/{id}")]
        public async Task<IActionResult> GetChatById([FromRoute] Guid id)
        {
            // Need to fetch All Chat Messages from Firestore through the service layer here
            var result = await _chatSessionService.GetByIdAsync(id);
            if (result == null) return NotFound($"No Chat Session with Id: {id} Found");

            _logger.LogInformation("Fetched Chat ID: {id}", id);
            return Ok(result);

        }
        [HttpPost("sessions/create")]
        public async Task<IActionResult> CreateChatSession([FromBody]CreateChatSessionDto dto)
        {
            var result = await _chatSessionService.CreateAsync(dto);

            _logger.LogInformation("Fetched Data: {data} ", result); // Should be bool data
            return Ok(new { Message = $"Data Fetched: {result}" });
        }

        [HttpPost("sessions/{id}/messages")]
        public async Task<IActionResult> CreateChatMessage(string id, [FromBody]CreateChatMessageDto dto)
        {
            // Call ChatMessageService
            var chatMessage = await _chatMessageService.CreateAsync(dto, id);

            if (chatMessage == null) return StatusCode(500, new { Message = "Unexpected error" });

            return Ok(new { Message = "Message Successfully stored", chatMessage });
        }

        [HttpPut("sessions/{id}/update")]
        public async Task<IActionResult> UpdateChatSessionTitle(Guid id, [FromBody] UpdateChatSessionDto updateDto)
        {
            var result = await _chatSessionService.UpdateAsync(updateDto, id);

            if (result == false) return StatusCode(500, result);

            return Ok(new { Message = "Chat Session Title Updated" });

        }
        [HttpDelete("/sessions/{id}/delete")]
        public async Task<IActionResult> DeleteChatSession(Guid id)
        {
            var success = await _chatSessionService.DeleteAsync(id);

            if (!success) return StatusCode(500, success);

            return Ok(new { Message = "Chat Message Deleted" });
        }


    }
}