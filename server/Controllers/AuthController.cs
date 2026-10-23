using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;
using server.Models.DTOs.User;
using server.Services.Email;
using server.Services.Interfaces;
using server.Services.Theses;

namespace server.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class AuthController : ControllerBase
    { 
        private readonly ILogger<AuthController> _logger;
        private readonly IStudentService _studentService;
        private readonly IFacultyService _facultyService;
        private readonly IProgramHeadService _programHeadService;
        private readonly IAdminService _adminService;
        private readonly IMfaStore _mfaStore;
        private readonly IFirebasePasswordService _passwordService;
        private readonly IEmailService _email;

        public AuthController(
            ILogger<AuthController> logger,
            IStudentService studentService,
            IFacultyService facultyService,
            IProgramHeadService programHeadService,
            IAdminService adminService,
            IMfaStore mfaStore,
            IFirebasePasswordService passwordService,
            IEmailService email)
        {
            _logger = logger;
            _studentService = studentService;
            _facultyService = facultyService;
            _programHeadService = programHeadService;
            _adminService = adminService;
            _mfaStore = mfaStore;
            _passwordService = passwordService;
            _email = email;
        }

        [HttpPost("register")]
        [Authorize(Policy = "FirebaseAuthenticated")]
        public async Task<IActionResult> RegisterUser([FromBody] RegisterUserDto dto)
        {
            if (string.IsNullOrEmpty(dto.Id))
                return BadRequest(new { Message = "Firebase UID is required." });

            // Role-specific email domains: students use @student.pnm.edu.ph,
            // faculty use @pnm.edu.ph (the student domain does not satisfy
            // EndsWith("@pnm.edu.ph") because of the extra "student." label).
            var email = dto.Email?.Trim() ?? string.Empty;
            if (dto.Role == "Student" &&
                !email.EndsWith("@student.pnm.edu.ph", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { Message = "Students must register with an @student.pnm.edu.ph email address." });
            if (dto.Role == "Faculty" &&
                !email.EndsWith("@pnm.edu.ph", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { Message = "Faculty must register with a @pnm.edu.ph email address." });

            var result = dto.Role switch
            {
                "Student" => await _studentService.RegisterAsync(dto, dto.Id),
                "Faculty" => await RegisterFacultyAsync(dto),
                _ => null
            };
            if (result == null)
                return BadRequest(new { Message = $"Unknown Role {dto.Role}" });
            _logger.LogInformation("User registered: {Id} as {Role}", dto.Id, dto.Role);
            return CreatedAtAction(nameof(RegisterUser), new { id = dto.Id }, result);
        }
        [HttpPost("register/admin-or-programhead")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> CreateAdminOrProgramHead([FromBody] RegisterUserDto dto)
        {
            if(string.IsNullOrEmpty(dto.Id))
                return BadRequest(new { Message = "Firebase UID is required"});
            var email = dto.Email?.Trim() ?? string.Empty;

            if(!email.EndsWith("@pnm.edu.ph", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { Message = "Admin or ProgramHead must be created with a @pnm.edu.ph associated email address."});
            
            var result = dto.Role switch
            {
                "Admin" => await RegisterAdminAsync(dto),
                "ProgramHead" => await RegisterProgramHeadAsync(dto),
                _ => null
            };

            if(result == null)
                return BadRequest(new { Message = $"Unknown Role {dto.Role}"});
            _logger.LogInformation("User registered: {Id} as {Role}", dto.Id, dto.Role);
            return CreatedAtAction(nameof(RegisterUser), new { id = dto.Id }, result);

        }

        [HttpPost("login")]
        public async Task<IActionResult> LoginAsync()
        {
            return Ok("Logged in Successfully!");
        }

        //  Student-number login (mobile) 
        // Intentionally anonymous + generic errors to avoid student-number enumeration.
        [HttpPost("resolve-login")]
        [AllowAnonymous]
        public async Task<IActionResult> ResolveStudentLogin([FromBody] ResolveLoginRequestDto dto)
        {
            var studentNumber = dto.StudentNumber.Trim();
            if (string.IsNullOrEmpty(studentNumber))
                return Unauthorized(new { Message = "Invalid student number or password." });

            var email = await _studentService.GetEmailByStudentNumberAsync(studentNumber);

            _logger.LogInformation("Email is {email}", email);
            if (string.IsNullOrEmpty(email))
            {
                _logger.LogWarning("Failed login resolution for student number");
                return Unauthorized(new { Message = "Invalid student number or password." });
            }

            return Ok(new ResolveLoginResponseDto { StudentNumber = studentNumber, Email = email });
        }

        //  Server-managed password change. Verifies the current password
        //  against Firebase, writes the new one via the Admin SDK, then queues
        //  the "password changed" security email. Per-user rate limited so this
        //  endpoint can't be used to brute-force a current password.
        [HttpPost("change-password")]
        [Authorize]
        [EnableRateLimiting("ChangePasswordLimit")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequestDto dto)
        {
            var uid = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(uid))
                return Unauthorized(new { Message = "No user ID found in token." });

            if (string.IsNullOrWhiteSpace(dto.CurrentPassword) || string.IsNullOrWhiteSpace(dto.NewPassword))
                return BadRequest(new { Message = "Current and new password are required." });
            if (dto.NewPassword.Length < 6)
                return BadRequest(new { Message = "New password must be at least 6 characters." });
            if (string.Equals(dto.CurrentPassword, dto.NewPassword, StringComparison.Ordinal))
                return BadRequest(new { Message = "New password must be different from the current password." });

            var user = await _mfaStore.FindUserAsync(uid);
            if (user?.Email is null)
                return NotFound(new { Message = "No user profile found for this account." });
            if (user.IsActive != true)
                return Unauthorized(new { Message = "Your account is not active." });

            if (!await _passwordService.VerifyCurrentPasswordAsync(user.Email, dto.CurrentPassword))
                return Unauthorized(new { Message = "Current password is incorrect." });

            await _passwordService.UpdatePasswordAsync(uid, dto.NewPassword);

            // Security email — fire-and-forget into the background queue.
            var content = EmailTemplates.PasswordChanged(
                ThesisAuthorNames.FormatPersonName(user), DateTime.UtcNow);
            _email.Queue(user.Email, content.Subject, content.Html, content.Text);

            _logger.LogInformation("Password changed for UID {Uid}", uid);
            return Ok(new { Message = "Password changed successfully." });
        }

        [HttpGet("me")]
        [Authorize]
        public async Task<IActionResult> GetCurrentUser()
        {
            var uid = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.Role);

            if (string.IsNullOrEmpty(uid))
                return Unauthorized(new { Message = "No user ID found in token." });

            // TPC = no shared table to query by UID alone, so check each
            // role's service until one matches.
            var student = await _studentService.GetProfileByIdAsync(uid);
            if (student != null) return Ok(student);

            var faculty = await _facultyService.GetByIdAsync(uid);
            if (faculty != null) return Ok(faculty);

            var admin = await _adminService.GetByIdAsync(uid);
            if (admin != null) return Ok(admin);

            var programHead = await _programHeadService.GetByIdAsync(uid);
            if (programHead != null) return Ok(programHead);

            return NotFound(new { Message = "No user profile found for this account." });
        }
        private async Task<UserResponseDto?> RegisterFacultyAsync(RegisterUserDto dto)
        {
            dto.Id ??= User.FindFirstValue("user_id");
            var created = await _facultyService.CreateAsync(dto);
            if (!created) return null;
            return await _facultyService.GetByIdAsync(dto.Id!);
        }

        private async Task<UserResponseDto?> RegisterProgramHeadAsync(RegisterUserDto dto)
        {
            dto.Id ??= User.FindFirstValue("user_id");
            var created = await _programHeadService.CreateAsync(dto);
            if (!created) return null;
            return await _programHeadService.GetByIdAsync(dto.Id!);
        }

        private async Task<UserResponseDto?> RegisterAdminAsync(RegisterUserDto dto)
        {
            dto.Id ??= User.FindFirstValue("user_id");
            var created = await _adminService.CreateAsync(dto);
            if (!created) return null;
            return await _adminService.GetByIdAsync(dto.Id!);
        }
    }
}