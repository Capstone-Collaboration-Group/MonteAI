using System;
using Microsoft.AspNetCore.Mvc;
using server.Models.DTOs.Thesis;
using server.Services;
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


        [HttpPost("/ingest")]
        public async Task<IActionResult> IngestThesis()
        {
            _logger.LogInformation("Haaaa");
            return Ok(new { Message = "Thesis Ingestion successfully completed and added to knowledge of MonteAI." });
        }

    }
}