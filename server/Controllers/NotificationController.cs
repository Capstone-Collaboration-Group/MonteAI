using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using server.Services.Interfaces;

namespace server.Controllers
{
    // Polling surface for the in-app bell: clients fetch the paged list +
    // unread badge, then PATCH read state. All endpoints are implicitly
    // scoped to the caller's uid — a user can only ever read/mark their own rows.
    [ApiController]
    [Route("api/v1/[controller]")]
    public class NotificationController : ControllerBase
    {
        private readonly INotificationService _service;
        private readonly ILogger<NotificationController> _logger;

        public NotificationController(INotificationService service, ILogger<NotificationController> logger)
        {
            _service = service;
            _logger = logger;
        }

        private string? UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("user_id");

        [HttpGet]
        public async Task<IActionResult> GetNotifications([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var uid = UserId;
            if (string.IsNullOrEmpty(uid))
                return Unauthorized(new { Message = "No user ID found in token." });

            var result = await _service.GetPagedAsync(uid, page, pageSize);
            return Ok(result);
        }

        [HttpGet("unread-count")]
        public async Task<IActionResult> GetUnreadCount()
        {
            var uid = UserId;
            if (string.IsNullOrEmpty(uid))
                return Unauthorized(new { Message = "No user ID found in token." });

            var count = await _service.GetUnreadCountAsync(uid);
            return Ok(new { UnreadCount = count });
        }

        [HttpPatch("{id:guid}/read")]
        public async Task<IActionResult> MarkRead(Guid id)
        {
            var uid = UserId;
            if (string.IsNullOrEmpty(uid))
                return Unauthorized(new { Message = "No user ID found in token." });

            var result = await _service.MarkReadAsync(id, uid);
            if (!result)
                return NotFound(new { Message = "Notification not found." });

            return Ok(new { Message = "Notification marked as read." });
        }

        [HttpPatch("read-all")]
        public async Task<IActionResult> MarkAllRead()
        {
            var uid = UserId;
            if (string.IsNullOrEmpty(uid))
                return Unauthorized(new { Message = "No user ID found in token." });

            var marked = await _service.MarkAllReadAsync(uid);
            _logger.LogInformation("Marked {Count} notification(s) read for {Uid}", marked, uid);
            return Ok(new { Marked = marked });
        }
    }
}
