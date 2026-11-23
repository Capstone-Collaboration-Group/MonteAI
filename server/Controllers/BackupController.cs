using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using server.Models.DTOs.Backup;
using server.Services.Interfaces;

namespace server.Controllers
{
    // Admin-only backup surface for the desktop Backup page:
    //   GET  stats      — live counts/sizes per category
    //   POST manifest   — inventory JSON (desktop saves it locally)
    //   POST pdf-plan   — container SAS + PDF list (desktop pulls from Blob)
    //   POST export     — full data-copy zip (database.json, firestore.json,
    //                     database.bacpac when selected, manifest, README)
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize(Roles = "Admin")]
    public class BackupController : ControllerBase
    {
        private readonly IBackupService _service;
        private readonly ILogger<BackupController> _logger;

        public BackupController(IBackupService service, ILogger<BackupController> logger)
        {
            _service = service;
            _logger = logger;
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats(CancellationToken cancellationToken)
        {
            var stats = await _service.GetStatsAsync(cancellationToken);
            return Ok(stats);
        }

        [HttpPost("manifest")]
        public async Task<IActionResult> CreateManifest(
            [FromBody] BackupManifestRequestDto request,
            CancellationToken cancellationToken)
        {
            if (request.Categories == null || request.Categories.Count == 0)
                return BadRequest(new { Message = "Select at least one backup category." });

            try
            {
                var manifest = await _service.CreateManifestAsync(request.Categories, cancellationToken);
                _logger.LogInformation(
                    "Generated backup manifest with {Count} categor(ies) for {User}",
                    manifest.Categories.Count,
                    User.Identity?.Name ?? "unknown user");
                return Ok(manifest);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { Message = ex.Message });
            }
        }

        [HttpPost("pdf-plan")]
        public async Task<IActionResult> GetPdfPlan(CancellationToken cancellationToken)
        {
            var plan = await _service.GetPdfPlanAsync(cancellationToken);
            return Ok(plan);
        }

        [HttpPost("export")]
        public async Task<IActionResult> Export(
            [FromBody] BackupManifestRequestDto request,
            CancellationToken cancellationToken)
        {
            if (request.Categories == null || request.Categories.Count == 0)
                return BadRequest(new { Message = "Select at least one backup category." });

            var tempZip = Path.Combine(Path.GetTempPath(), $"monteai-export-{Guid.NewGuid():N}.zip");
            try
            {
                // Payloads are built before the zip exists — category/Firestore/
                // sqlpackage failures here abort with nothing left on disk.
                await _service.WriteExportZipAsync(request.Categories, tempZip, cancellationToken);
            }
            catch (ArgumentException ex)
            {
                TryDelete(tempZip);
                return BadRequest(new { Message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                TryDelete(tempZip);
                return BadRequest(new { Message = ex.Message });
            }
            catch (Exception ex)
            {
                TryDelete(tempZip);
                _logger.LogError(ex, "Backup export failed");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { Message = $"Backup export failed: {ex.Message}" });
            }

            var fileName = $"monteai-export-{DateTime.UtcNow:yyyy-MM-dd_HH-mm-ss}.zip";
            Response.OnCompleted(() =>
            {
                TryDelete(tempZip);
                return Task.CompletedTask;
            });

            _logger.LogInformation("Serving backup export {File} ({Bytes} bytes) to {User}",
                fileName, new FileInfo(tempZip).Length, User.Identity?.Name ?? "unknown user");
            return PhysicalFile(tempZip, "application/zip", fileName);
        }

        private void TryDelete(string path)
        {
            try
            {
                if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not delete temp file {Path}", path);
            }
        }
    }
}
