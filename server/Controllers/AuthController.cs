using Microsoft.AspNetCore.Mvc;
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
        
        //REMEMBER TO ADD FACULTY, PROGRAMHEAD, AND ADMIN SERVICES HERE!!
        public AuthController(ILogger<AuthController> logger, IStudentService studentService)
        {
            _logger = logger;
            _studentService = studentService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> RegisterUser([FromBody] RegisterUserDto dto)
        {
            if (string.IsNullOrEmpty(dto.FirebaseUid))
                return BadRequest(new { Message = "Firebase UID is required." });

            

            var result = dto.Role switch
            {
                "Student" => await _studentService.RegisterAsync(dto, dto.FirebaseUid),

                // ADD OTHER REGISTERASYNC SERVICES HERE SOON
                _ => null
            };
            if (result == null)
                return BadRequest(new { Message = $"Unknown Role {dto.Role}" });

            _logger.LogInformation("User registered: {Id} as {Role}", dto.FirebaseUid, dto.Role);

            return CreatedAtAction(nameof(RegisterUser), new { id = dto.FirebaseUid }, result);

        }

        [HttpPost("/login")]
        public async Task<IActionResult> LoginAsync()
        {
            return Ok("Logged in Successfully!");
        }

        
    }
}