using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using server.Models.DTOs.User;
using server.Services.Interfaces;

namespace server.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly ILogger<AuthController> _logger;
        private readonly IStudentService _studentService;
        private readonly IFacultyService _facultyService;
        private readonly IProgramHeadService _programHeadService;
        private readonly IAdminService _adminService;

        public AuthController(
            ILogger<AuthController> logger,
            IStudentService studentService,
            IFacultyService facultyService,
            IProgramHeadService programHeadService,
            IAdminService adminService)
        {
            _logger = logger;
            _studentService = studentService;
            _facultyService = facultyService;
            _programHeadService = programHeadService;
            _adminService = adminService;
        }

        [HttpPost("register")]
        [Authorize(Policy = "FirebaseAuthenticated")]
        public async Task<IActionResult> RegisterUser([FromBody] RegisterUserDto dto)
        {
            if (string.IsNullOrEmpty(dto.Id))
                return BadRequest(new { Message = "Firebase UID is required." });
            var result = dto.Role switch
            {
                "Student" => await _studentService.RegisterAsync(dto, dto.Id),
                "Faculty" => await RegisterFacultyAsync(dto),
                "ProgramHead" => await RegisterProgramHeadAsync(dto),
                "Admin" => await RegisterAdminAsync(dto),
                _ => null
            };
            if (result == null)
                return BadRequest(new { Message = $"Unknown Role {dto.Role}" });
            _logger.LogInformation("User registered: {Id} as {Role}", dto.Id, dto.Role);
            return CreatedAtAction(nameof(RegisterUser), new { id = dto.Id }, result);
        }

        [HttpPost("login")]
        public async Task<IActionResult> LoginAsync()
        {
            return Ok("Logged in Successfully!");
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
            var student = await _studentService.GetByIdAsync(uid);
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