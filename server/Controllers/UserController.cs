using System.Security.Claims;
using FirebaseAdmin.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using server.Models.DTOs.ProgramHead;
using server.Models.DTOs.User;
using server.Services.Interfaces;

namespace server.Controllers
{
    /// <summary>
    /// Endpoints for the authenticated user's own account settings. Every
    /// action dispatches to the role-specific service (Student/Faculty/Admin/
    /// ProgramHead) based on the Role claim injected by RoleAuthorizationMiddleware.
    /// </summary>
    [ApiController]
    [Authorize]
    [Route("api/v1/[controller]")]
    public class UserController : ControllerBase
    {
        private readonly IStudentService _studentService;
        private readonly IFacultyService _facultyService;
        private readonly IAdminService _adminService;
        private readonly IProgramHeadService _programHeadService;
        private readonly ILogger<UserController> _logger;

        public UserController(
            IStudentService studentService,
            IFacultyService facultyService,
            IAdminService adminService,
            IProgramHeadService programHeadService,
            ILogger<UserController> logger)
        {
            _studentService = studentService;
            _facultyService = facultyService;
            _adminService = adminService;
            _programHeadService = programHeadService;
            _logger = logger;
        }

        /// <summary>GET /api/v1/User/me — profile of the current user, shaped by role.</summary>
        [HttpGet("me")]
        public async Task<IActionResult> GetCurrentUser()
        {
            var uid = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var role = User.FindFirstValue(ClaimTypes.Role);

            if (string.IsNullOrEmpty(uid) || string.IsNullOrEmpty(role))
                return Unauthorized(new { Message = "No user ID found in token." });

            var profile = await GetProfileAsync(uid, role);
            if (profile is null)
                return NotFound(new { Message = "No user profile found for this account." });

            return Ok(profile);
        }

        /// <summary>PUT /api/v1/User/me — partial update of the current user's profile.</summary>
        [HttpPut("me")]
        public async Task<IActionResult> UpdateCurrentUser([FromBody] UpdateUserDto dto)
        {
            var uid = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var role = User.FindFirstValue(ClaimTypes.Role);

            if (string.IsNullOrEmpty(uid) || string.IsNullOrEmpty(role))
                return Unauthorized(new { Message = "No user ID found in token." });

            // Role is derived from the caller's profile — never trust it from the client.
            dto.Role = null;
            // Email is read-only for self-service settings: it must stay in sync
            // with the Firebase sign-in email (changing only the DB row would
            // break student-number login).
            dto.Email = null;

            bool updated;
            switch (role)
            {
                case "Student":
                {
                    updated = await _studentService.UpdateAsync(uid, dto) is not null;
                    break;
                }
                case "Faculty":
                {
                    var existing = await _facultyService.GetByIdAsync(uid);
                    if (existing is null) return NotFound(new { Message = "Faculty profile not found." });
                    updated = await _facultyService.UpdateAsync(MergeProfile(existing, dto), uid);
                    break;
                }
                case "Admin":
                {
                    var existing = await _adminService.GetByIdAsync(uid);
                    if (existing is null) return NotFound(new { Message = "Admin profile not found." });
                    updated = await _adminService.UpdateAsync(MergeProfile(existing, dto), uid);
                    break;
                }
                case "ProgramHead":
                {
                    var existing = await _programHeadService.GetByIdAsync(uid);
                    if (existing is null) return NotFound(new { Message = "Program head profile not found." });
                    var merged = MergeProfile(existing, dto);
                    updated = await _programHeadService.UpdateAsync(MapToProgramHeadUpdate(merged), uid);
                    break;
                }
                default:
                    return Forbid();
            }

            if (!updated)
                return BadRequest(new { Message = "Profile update was not successful. Please try again." });

            var profile = await GetProfileAsync(uid, role);
            if (profile is null)
                return NotFound(new { Message = "No user profile found for this account." });

            _logger.LogInformation("Profile updated for {Role} {Uid}", role, uid);
            return Ok(profile);
        }

        /// <summary>
        /// POST /api/v1/User/revoke-sessions — revokes every Firebase refresh
        /// token for this account, signing the user out of all devices on their
        /// next token refresh.
        /// </summary>
        [HttpPost("revoke-sessions")]
        public async Task<IActionResult> RevokeSessions()
        {
            var uid = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(uid))
                return Unauthorized(new { Message = "No user ID found in token." });

            try
            {
                await FirebaseAuth.DefaultInstance.RevokeRefreshTokensAsync(uid);
            }
            catch (FirebaseAuthException ex)
            {
                _logger.LogError(ex, "Failed to revoke refresh tokens for {Uid}", uid);
                return StatusCode(StatusCodes.Status502BadGateway,
                    new { Message = "Could not sign out other devices. Please try again." });
            }

            _logger.LogInformation("Revoked all refresh tokens for {Uid}", uid);
            return Ok(new { Message = "Signed out of all other devices." });
        }

        private async Task<object?> GetProfileAsync(string uid, string role)
        {
            return role switch
            {
                "Student" => await _studentService.GetProfileByIdAsync(uid),
                "Faculty" => await _facultyService.GetByIdAsync(uid),
                "Admin" => await _adminService.GetByIdAsync(uid),
                "ProgramHead" => await _programHeadService.GetByIdAsync(uid),
                _ => null,
            };
        }

        /// <summary>
        /// Overlays the caller's non-null changes onto their existing profile so
        /// the role services always receive a complete DTO (their repositories
        /// persist role-specific fields such as Institute).
        /// </summary>
        private static UpdateUserDto MergeProfile(UserResponseDto existing, UpdateUserDto incoming)
        {
            return new UpdateUserDto
            {
                Email = existing.Email,
                FirstName = incoming.FirstName ?? existing.FirstName,
                MiddleInitial = incoming.MiddleInitial ?? existing.MiddleInitial,
                LastName = incoming.LastName ?? existing.LastName,
                Suffix = incoming.Suffix ?? existing.Suffix,
                Role = existing.Role,
                IsActive = existing.IsActive,
                StudentNumber = incoming.StudentNumber ?? existing.StudentNumber,
                Institute = incoming.Institute ?? existing.Institute,
                Program = incoming.Program ?? existing.Program,
                YearLevel = incoming.YearLevel ?? existing.YearLevel,
                Position = incoming.Position ?? existing.Position,
                ProgramHandled = incoming.ProgramHandled ?? existing.ProgramHandled,
            };
        }

        private static UpdateProgramHeadDto MapToProgramHeadUpdate(UpdateUserDto merged)
        {
            return new UpdateProgramHeadDto
            {
                Email = merged.Email,
                FirstName = merged.FirstName,
                MiddleInitial = merged.MiddleInitial,
                LastName = merged.LastName,
                Suffix = merged.Suffix,
                Institute = merged.Institute,
                ProgramHandled = merged.ProgramHandled,
                IsActive = merged.IsActive,
            };
        }
    }
}
