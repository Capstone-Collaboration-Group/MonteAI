using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using server.Configuration;
using server.Models.Agent;
using server.Models.DTOs.ChatMessage;
using server.Models.DTOs.ChatSession;
using server.Services.Interfaces;

// server/Controllers/ChatController.cs
//
// Chat endpoints. One message round-trip:
//
//   POST /api/v1/chat/sessions/{id}/messages            (blocking)
//   POST /api/v1/chat/sessions/{id}/messages/stream     (SSE)
//
//   1. Validate payload + session OWNERSHIP (the authenticated Firebase uid
//      must match the session's owner — closes the IDOR where any user could
//      post into any session id).
//   2. Load conversation history (BEFORE persisting the new user message, so
//      history = prior turns only) -> sent to the agent as memory.
//   3. Persist the user message; bump the session's LastChatDate.
//   4. Run IMonteAiAgentService (plan -> tools -> grounded answer, see
//      MonteAiAgentService for the full loop).
//   5. Persist the assistant message WITH its structured sources and return it.
//
//   The streaming variant emits Server-Sent Events:
//     event: sources  data: [ { thesisId, title, authors, ... } ]
//     event: delta    data: { "text": "...answer fragment..." }
//     event: done     data: { "message": { persisted assistant message } }
//     event: error    data: { "message": "..." }   (terminal failure only)

namespace server.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class ChatController : ControllerBase
    {
        /// <summary>camelCase JSON for manually written SSE payloads (matches controller serialization defaults).</summary>
        private static readonly JsonSerializerOptions SseJsonOptions = new(JsonSerializerDefaults.Web);

        private readonly IChatSessionService _chatSessionService;
        private readonly IChatMessageService _chatMessageService;
        private readonly IMonteAiAgentService _monteAiAgentService;
        private readonly MonteAiAgentConfig _agentConfig;
        private readonly ILogger<ChatController> _logger;

        public ChatController(
            IChatSessionService chatSessionService,
            IChatMessageService chatMessageService,
            IMonteAiAgentService monteAiAgentService,
            IOptions<MonteAiAgentConfig> agentConfig,
            ILogger<ChatController> logger)
        {
            _chatSessionService = chatSessionService;
            _chatMessageService = chatMessageService;
            _monteAiAgentService = monteAiAgentService;
            _agentConfig = agentConfig.Value;
            _logger = logger;
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

            // Ownership: a session may only be read by its owner.
            var uid = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!string.Equals(result.UserId, uid, StringComparison.Ordinal))
            {
                return Forbid();
            }

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

        /// <summary>Blocking send: runs the full agent loop, then returns both persisted messages.</summary>
        [HttpPost("sessions/{id}/messages")]
        [EnableRateLimiting("ChatLimit")]
        public async Task<IActionResult> SendChatMessage([FromRoute] Guid id, [FromBody] CreateChatMessageDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto?.Content))
            {
                return BadRequest(new { Message = "Message content cannot be empty." });
            }

            var ownershipError = await CheckOwnershipAsync(id);
            if (ownershipError != null) return ownershipError;

            try
            {
                // 1. History first (prior turns only — the current user message
                //    has not been persisted yet).
                var history = await _chatMessageService.GetHistoryAsync(id, _agentConfig.HistoryMessageCount);

                // 2. Persist the incoming user message + refresh the session.
                var userMessage = await _chatMessageService.CreateAsync(dto, id.ToString());
                if (userMessage == null)
                {
                    return StatusCode(500, new { Message = "Failed to persist user message." });
                }
                await _chatSessionService.TouchAsync(id);

                // 3. Run the agent (plan -> tools -> grounded, cited answer).
                var result = await _monteAiAgentService.GenerateResponseAsync(
                    new AgentChatRequest(dto.Content, history));

                // 4. Persist the assistant message together with its sources.
                var aiMessage = await _chatMessageService.CreateAsync(
                    new CreateChatMessageDto { Content = result.Answer, Role = "assistant" },
                    id.ToString(),
                    result.Sources);

                if (aiMessage == null)
                {
                    _logger.LogWarning("Agent generated a response but persistence failed for session {SessionId}", id);
                    return Ok(new { Message = "Message generated but failed to persist AI response", userMessage, aiMessage = new { content = result.Answer, sources = result.Sources } });
                }

                return Ok(new { Message = "Message successfully stored", userMessage, aiMessage });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "MonteAI agent failed for session {SessionId}", id);
                return StatusCode(500, new { Message = "MonteAI could not generate a response. Please try again." });
            }
        }

        /// <summary>
        /// Streaming send: identical pipeline to SendChatMessage, but the final
        /// answer is streamed to the client as Server-Sent Events while it is
        /// being generated.
        /// </summary>
        [HttpPost("sessions/{id}/messages/stream")]
        [EnableRateLimiting("ChatLimit")]
        public async Task SendMessageStream([FromRoute] Guid id, [FromBody] CreateChatMessageDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto?.Content))
            {
                Response.StatusCode = StatusCodes.Status400BadRequest;
                await Response.WriteAsJsonAsync(new { Message = "Message content cannot be empty." });
                return;
            }

            var ownershipError = await CheckOwnershipAsync(id, writeResponse: true);
            if (ownershipError != null) return; // response already written

            var history = await _chatMessageService.GetHistoryAsync(id, _agentConfig.HistoryMessageCount);
            var userMessage = await _chatMessageService.CreateAsync(dto, id.ToString());
            await _chatSessionService.TouchAsync(id);

            // Switch the response into SSE mode.
            Response.StatusCode = StatusCodes.Status200OK;
            Response.ContentType = "text/event-stream";
            Response.Headers.CacheControl = "no-cache";

            var answerBuffer = new StringBuilder();
            IReadOnlyList<ChatSourceDto> sources = [];

            try
            {
                await foreach (var evt in _monteAiAgentService.StreamResponseAsync(
                    new AgentChatRequest(dto.Content, history),
                    HttpContext.RequestAborted))
                {
                    switch (evt)
                    {
                        case AgentStreamEvent.SourcesDiscovered sourcesEvent:
                            sources = sourcesEvent.Sources;
                            await WriteSseEventAsync("sources", JsonSerializer.Serialize(sourcesEvent.Sources, SseJsonOptions));
                            break;

                        case AgentStreamEvent.AnswerDelta delta:
                            answerBuffer.Append(delta.Text);
                            await WriteSseEventAsync("delta", JsonSerializer.Serialize(new { text = delta.Text }, SseJsonOptions));
                            break;

                        case AgentStreamEvent.Completed completed:
                            var aiMessage = await _chatMessageService.CreateAsync(
                                new CreateChatMessageDto { Content = completed.Result.Answer, Role = "assistant" },
                                id.ToString(),
                                completed.Result.Sources);
                            await WriteSseEventAsync("done", JsonSerializer.Serialize(new { message = aiMessage }, SseJsonOptions));
                            break;
                    }
                }
            }
            catch (OperationCanceledException)
            {
                // Client disconnected mid-stream. Persist whatever was already
                // generated so the conversation history is not lost.
                if (answerBuffer.Length > 0)
                {
                    _logger.LogInformation("Client disconnected mid-stream for session {SessionId} — persisting partial answer", id);
                    await _chatMessageService.CreateAsync(
                        new CreateChatMessageDto { Content = answerBuffer.ToString(), Role = "assistant" },
                        id.ToString(),
                        sources);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Streaming agent failed for session {SessionId}", id);
                if (!Response.HasStarted)
                {
                    Response.StatusCode = StatusCodes.Status500InternalServerError;
                    await Response.WriteAsJsonAsync(new { Message = "MonteAI could not generate a response. Please try again." });
                }
                else
                {
                    await WriteSseEventAsync("error", JsonSerializer.Serialize(new { message = "MonteAI could not generate a response. Please try again." }, SseJsonOptions));
                }
            }
            finally
            {
                await Response.Body.FlushAsync();
            }
        }

        [HttpPut("sessions/{id}/update")]
        public async Task<IActionResult> UpdateChatSessionTitle([FromRoute] Guid id, [FromBody] UpdateChatSessionDto updateDto)
        {
            var result = await _chatSessionService.UpdateAsync(updateDto, id);
            if (!result) return StatusCode(500, new { Message = "Failed to update chat session title." });

            return Ok(new { Message = "Chat Session Title Updated" });
        }

        [HttpDelete("sessions/{id}/delete")]
        public async Task<IActionResult> DeleteChatSession([FromRoute] Guid id)
        {
            var success = await _chatSessionService.DeleteAsync(id);
            if (!success) return StatusCode(500, new { Message = "Failed to delete chat session." });

            return Ok(new { Message = "Chat Session Deleted" });
        }

        // ────────────────────── helpers ──────────────────────

        /// <summary>
        /// Ensures the session exists and belongs to the caller. Returns null
        /// when authorized; otherwise an IActionResult (normal requests) or
        /// writes the error to the response directly (SSE requests).
        /// </summary>
        private async Task<IActionResult?> CheckOwnershipAsync(Guid id, bool writeResponse = false)
        {
            var ownerUserId = await _chatSessionService.GetOwnerUserIdAsync(id);

            if (ownerUserId == null)
            {
                if (writeResponse)
                {
                    Response.StatusCode = StatusCodes.Status404NotFound;
                    await Response.WriteAsJsonAsync(new { Message = $"No chat session with id {id} found." });
                    return new EmptyResult();
                }
                return NotFound($"No chat session with id {id} found.");
            }

            var uid = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!string.Equals(ownerUserId, uid, StringComparison.Ordinal))
            {
                _logger.LogWarning("User {Uid} attempted to access session {SessionId} owned by {Owner}", uid, id, ownerUserId);
                if (writeResponse)
                {
                    Response.StatusCode = StatusCodes.Status403Forbidden;
                    await Response.WriteAsJsonAsync(new { Message = "You do not have access to this chat session." });
                    return new EmptyResult();
                }
                return Forbid();
            }

            return null;
        }

        /// <summary>Writes one SSE frame ("event: name\ndata: json\n\n") and flushes it to the client.</summary>
        private async Task WriteSseEventAsync(string eventName, string jsonData)
        {
            await Response.WriteAsync($"event: {eventName}\ndata: {jsonData}\n\n", Encoding.UTF8);
            await Response.Body.FlushAsync();
        }
    }
}
