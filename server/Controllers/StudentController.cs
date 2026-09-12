using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using server.Services.Interfaces;

namespace server.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/v1/[controller]")]
    public class StudentController
    (
        IStudentService _service,
        ILogger<StudentController> _logger
    ) : ControllerBase
    {
        /// <summary>
        /// Student directory for research-group invitations. Students are
        /// always scoped to their own program; Staff may optionally filter.
        /// </summary>
        [HttpGet]
        [Authorize(Roles = "Student,Faculty,ProgramHead,Admin")]
        public async Task<IActionResult> GetStudents(
            [FromQuery] string? search,
            [FromQuery] string? program)
        {
            var uid = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var role = User.FindFirstValue(ClaimTypes.Role);

            if (role == "Student")
            {
                if (string.IsNullOrEmpty(uid)) return Unauthorized();

                var me = await _service.GetProfileByIdAsync(uid);
                if (me is null) return Forbid();

                // Students may only see classmates in their own program.
                program = me.Program;
            }

            var result = await _service.GetDirectoryAsync(search, program);

            _logger.LogInformation("Fetched {count} students for directory", result.Count());
            return Ok(result);
        }

        [HttpGet("{id}")]
        [Authorize(Roles = "Student,Faculty,ProgramHead,Admin")]
        public async Task<IActionResult> GetStudent(string id)
        {
            var result = await _service.GetProfileByIdAsync(id);

            if (result is null)
                return NotFound(new { Message = "Student Not Found" });

            return Ok(result);
        }
    }
}
