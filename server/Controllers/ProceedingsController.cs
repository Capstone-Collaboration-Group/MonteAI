using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using server.Services.Interfaces;
using server.Services.Theses;

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
        [Authorize(Policy = "Proceedings")]
        [EnableRateLimiting("ProceedingsLimit")]
        public async Task<IActionResult> GenerateProceedings(
            Guid thesisId,
            CancellationToken cancellationToken)
        {
            if (User.IsInRole("Student"))
            {
                var studentId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (string.IsNullOrEmpty(studentId))
                    return Unauthorized();

                if (!await _proceedingsService.IsStudentThesisMemberAsync(
                    thesisId,
                    studentId,
                    cancellationToken))
                    return Forbid();
            }

            try
            {
                var pdf = await _proceedingsService.GenerateProceedingsAsync(thesisId, cancellationToken);
                if (pdf is null)
                    return NotFound(new { Message = $"Thesis {thesisId} not found." });

                _logger.LogInformation("Proceedings generated for thesis {ThesisId}", thesisId);

                return File(pdf, "application/pdf", $"thesis-proceedings-{thesisId}.pdf");
            }
            catch (AnnotationReadException ex)
            {
                _logger.LogError(ex, "Proceedings generation cancelled because annotations could not be read for thesis {ThesisId}", thesisId);
                return StatusCode(
                    StatusCodes.Status503ServiceUnavailable,
                    new { Message = "Proceedings could not be generated because annotations could not be retrieved. Please try again." });
            }
            catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Failed to generate proceedings for thesis {ThesisId}", thesisId);
                return StatusCode(
                    StatusCodes.Status500InternalServerError,
                    new { Message = "Proceedings could not be generated. Please try again." });
            }
        }
    }
}