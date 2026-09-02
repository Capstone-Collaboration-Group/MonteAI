using Microsoft.AspNetCore.Mvc;
using server.Services.Interfaces;

namespace server.Controllers
{
    [ApiController]
    [Route("api/v1/thesis")]
    public class ProceedingsController : ControllerBase
    {
        private readonly ILogger<ProceedingsController> _logger;
        private readonly IProceedingsService _proceedingsService;

        public ProceedingsController(
            ILogger<ProceedingsController> logger,
            IProceedingsService proceedingsService)
        {
            _logger = logger;
            _proceedingsService = proceedingsService;
        }

        [HttpPost("{thesisId}/proceedings")]
        public async Task<IActionResult> GenerateProceedings(Guid thesisId)
        {
            _logger.LogInformation(
                "Generating proceedings for thesis {ThesisId}",
                thesisId
            );

            var pdf = await _proceedingsService.GenerateProceedingsAsync(thesisId);

            _logger.LogInformation(
                "Proceedings generated successfully for thesis {ThesisId}",
                thesisId
            );

            return File(
                pdf,
                "application/pdf",
                $"thesis-proceedings-{thesisId}.pdf"
            );
        }
    }
}