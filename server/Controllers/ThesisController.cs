using Microsoft.AspNetCore.Mvc;
using server.Models.DTOs.Thesis;
using server.Services.Interfaces;

/**SUMMARY
 * The API controller for thesis related functions 
 * Will not directly call the data layer
 * Ensures the flow controller -> Service -> Repository -> Data Layer(SQL/Vector DB)
 **/
namespace server.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class ThesisController : ControllerBase
    {
        private readonly ILogger<ThesisController> _logger;
        private readonly IThesisService _service;
        public ThesisController(ILogger<ThesisController> logger, IThesisService service)
        {
            _logger = logger;
            _service = service;
        }

        [HttpGet]
        public async Task<IActionResult> GetFirst20Thesis()
        {
            var result = await _service.GetFirst20ThesisAsync();

            return Ok(result);
        }
        [HttpGet("{id}")]
        public async Task<IActionResult> GetThesisById(Guid id)
        {
            var result = await _service.GetByIdAsync(id);

            return Ok(result);
        }

        [HttpPost("submit")]
        public async Task<IActionResult> SubmitThesis([FromBody] SubmitThesisDto dto)
        {
            var result = await _service.SubmitAsync(dto);

            _logger.LogInformation("Fetched Data: {result}", result);

            return Ok(result);
        }

        // Need to implement the pinecone ingestion of thesis after approval.
        [HttpPost("ingest")]
        public async Task<IActionResult> IngestThesis([FromBody] IngestThesisDto dto)
        {
            var result = await _service.IngestAsync(dto);
            _logger.LogInformation("Haaaa");
            return Ok(new { result, Message = "Thesis Ingestion successfully completed and added to knowledge of MonteAI." });
        }
        [HttpPut("update/details/{id}")]
        public async Task<IActionResult> UpdateThesisDetails([FromBody] UpdateThesisDto dto, Guid id)
        {
            var result = await _service.UpdateDetailsAsync(id, dto);

            if (result is false) return StatusCode(500, result);

            _logger.LogInformation("Thesis Details with Id: {id} updated successfully", id);
            return Ok(new { Message = "Thesis Details Updated Successfully" });
        }
        [HttpPatch("update/status/{id}")]
        public async Task<IActionResult> UpdateThesisStatus([FromBody] UpdateThesisStatusDto dto, Guid id)
        {
            var result = await _service.UpdateStatusAsync(id, dto);

            if (result is false) return StatusCode(500, result);

            _logger.LogInformation("Thesis Status with Id: {id} successfully Updated", id);
            return Ok(new { Message = "ThesisDetails Updated Successfully" });
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> DeleteThesis(Guid id)
        {
            var result = await _service.DeleteAsync(id);

            if (result is false) return StatusCode(500);
            _logger.LogInformation("Thesis with Id: {id} successfully deleted", id);

            return Ok(new { Message = $"Thesis {id} Deleted Successfully" });
        }

    }
}