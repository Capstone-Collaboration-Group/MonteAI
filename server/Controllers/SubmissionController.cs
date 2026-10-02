
using Microsoft.AspNetCore.Mvc;
using server.Models.DTOs.Submission;
using server.Services.Interfaces;

namespace server.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class SubmissionController : ControllerBase
    {
        private readonly ISubmissionService _service;
        private readonly ILogger<SubmissionController> _logger;
        public SubmissionController(ISubmissionService service, ILogger<SubmissionController> logger)
        {
            _service = service;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> GetAllSubmissions()
        {
            var result = await _service.GetAllAsync();
            return Ok(result);
        }

        [HttpGet("{studentNumber}/{thesisId}")]
        public async Task<IActionResult> GetSubmissionsByStudentNumber(string studentNumber, Guid thesisId)
        {
            var result = await _service.GetAllByUserIdAsync(studentNumber, thesisId);
            return Ok(result);

        }
        [HttpGet("{id}")]
        public async Task<IActionResult> GetSubmissionById(Guid id)
        {
            var result = await _service.GetByIdAsync(id);
            if (result == null) return StatusCode(500, result);

            return Ok(result);
        }
        [HttpPost("create")]
        public async Task<IActionResult> CreateSubmission([FromBody] CreateSubmissionDto dto)
        {
            var result = await _service.CreateAsync(dto);
            if (result == null) return BadRequest("Request Timeout, try again later");

            return Ok(result);
        }
        [HttpPut("update/{id}")]
        public async Task<IActionResult> UpdateSubmission([FromBody] UpdateSubmissionDto dto, Guid id)
        {
            var result = await _service.UpdateAsync(dto, id);
            if (result == null) return BadRequest("Reques Timeout, try again later");

            return Ok(result);
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> DeleteSubmission(Guid id)
        {
            var result = await _service.DeleteAsync(id);
            if (result == false) return BadRequest("Request Timeout, try again later...");

            return Ok(result);
        }
        


    }
}
