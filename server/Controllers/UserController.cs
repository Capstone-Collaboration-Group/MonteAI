using Microsoft.AspNetCore.Mvc;

namespace server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UserController : ControllerBase
    {
        private readonly ILogger<UserController> _logger;

        public UserController(ILogger<UserController> logger)
        {
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> GetStudent(int? id)
        {
            int dbId = 101;

            if(dbId != id || id == null)
            {
                _logger.LogError("Student cannot be found");
                return BadRequest("Student Cannot be found");
            }
            _logger.LogInformation("Student found, logging in");
            return Ok(new { Message = "Student found loggin in" });
        }
    }
}