using System.Security.Claims;
using Azure.Storage.Sas;
using Microsoft.AspNetCore.Authorization;
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
        private readonly IBlobService _blobService;
        public ThesisController(ILogger<ThesisController> logger, IThesisService service, IBlobService blobService)
        {
            _logger = logger;
            _service = service;
            _blobService = blobService;
        }

        private const long MaxUploadBytes = 25 * 1024 * 1024;

        // Server-side gate for every thesis upload (initial submission + revisions).
        // The UI already restricts the file picker to PDFs, but the API must not
        // trust the client. Returns null when the file is acceptable, otherwise a
        // message to send back as 400 — always BEFORE anything hits blob storage.
        private static async Task<string?> ValidatePdfAsync(IFormFile file)
        {
            if (file.Length == 0)
                return "File is empty.";

            if (file.Length > MaxUploadBytes)
                return "File must be 25 MB or smaller.";

            if (!string.Equals(Path.GetExtension(file.FileName), ".pdf", StringComparison.OrdinalIgnoreCase))
                return "Only PDF files are allowed.";

            if (!string.Equals(file.ContentType, "application/pdf", StringComparison.OrdinalIgnoreCase))
                return "Only PDF files are allowed.";

            // Magic bytes: a real PDF starts with "%PDF-". Extension and MIME type
            // are both client-controlled; the header is the only reliable signal.
            await using var stream = file.OpenReadStream();
            if (stream.CanSeek) stream.Position = 0;

            var header = new byte[5];
            var totalRead = 0;
            while (totalRead < header.Length)
            {
                var read = await stream.ReadAsync(header.AsMemory(totalRead, header.Length - totalRead));
                if (read == 0) break;
                totalRead += read;
            }
            if (stream.CanSeek) stream.Position = 0;

            var isPdf = totalRead == header.Length
                && header[0] == (byte)'%'
                && header[1] == (byte)'P'
                && header[2] == (byte)'D'
                && header[3] == (byte)'F'
                && header[4] == (byte)'-';

            return isPdf ? null : "File does not appear to be a valid PDF.";
        }

        [HttpGet]
        public async Task<IActionResult> GetFirst20Thesis([FromQuery] string? program)
        {
            var studentId = User.IsInRole("Student")
                ? User.FindFirstValue(ClaimTypes.NameIdentifier)
                : null;
            if (User.IsInRole("Student") && string.IsNullOrEmpty(studentId))
                return Unauthorized();

            var result = await _service.GetFirst20ThesisAsync(program, studentId);

            return Ok(result);
        }
        // The signed-in student's own group thesis — powers the /submit page.
        // 404 means "no thesis submitted yet" (client renders its empty state).
        // Literal "my" takes precedence over the {id} route below.
        [HttpGet("my")]
        [Authorize(Roles = "Student,Admin")]
        public async Task<IActionResult> GetMyThesis()
        {
            var uid = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(uid)) return Unauthorized();

            var result = await _service.GetMyThesisAsync(uid);
            if (result is null) return NotFound(new { Message = "No thesis submitted yet." });
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetThesisById(Guid id)
        {
            var result = await _service.GetByIdAsync(id);
            if (result == null) return NotFound();
            return Ok(result);
        }

        [HttpPost("submit")]
        [Authorize(Roles = "Student,Admin")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> SubmitThesis([FromForm] SubmitThesisDto dto)
        {
            if (dto.File == null)
                return BadRequest("File is required");

            var pdfError = await ValidatePdfAsync(dto.File);
            if (pdfError != null)
                return BadRequest(pdfError);

            var uploaderId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(uploaderId))
                return Unauthorized();

            var isAdmin = User.IsInRole("Admin");

            // Admins may archive legacy (hard-copy) theses on behalf of the repository —
            // attribute the upload to the acting account instead of trusting the client.
            if (isAdmin)
                dto.UploadedById = uploaderId;

            await using var stream = dto.File.OpenReadStream();

            var blobUrl = await _blobService.UploadAsync(
                    stream,
                    dto.File.FileName,
                    dto.File.ContentType,
                    dto.Title // blob name is derived from the thesis title
                );

            dto.FilePath = blobUrl;

            try
            {
                var result = await _service.SubmitAsync(dto, uploaderId, isAdmin);

                _logger.LogInformation("Thesis submitted successfully: {ThesisId}", result.Id);

                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "Thesis submission rejected: {Reason}", ex.Message);

                // The blob was uploaded before validation — take it back or every
                // rejected attempt (year gate, duplicate group…) leaks a PDF.
                await TryDeleteUploadedBlobAsync(blobUrl);

                return Conflict(new
                {
                    Message = ex.Message
                });
            }
            catch
            {
                await TryDeleteUploadedBlobAsync(blobUrl);
                throw;
            }
        }

        // Best-effort rollback for uploads whose submit/revision never landed in SQL.
        private async Task TryDeleteUploadedBlobAsync(string blobUrl)
        {
            try
            {
                await _blobService.DeleteAsync(blobUrl);
                _logger.LogInformation("Rolled back orphaned upload: {BlobUrl}", blobUrl);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to roll back orphaned upload {BlobUrl}", blobUrl);
            }
        }

        // Desktop-driven ingestion: the Electron pipeline extracts + chunks the
        // abstract, then this endpoint embeds and upserts it (see ThesisService).
        [HttpPost("ingest")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> IngestThesis([FromBody] IngestThesisDto dto)
        {
            var result = await _service.IngestAsync(dto);
            _logger.LogInformation("Thesis {ThesisId} ingestion finished with status {Status}", dto.ThesisId, result.Status);
            return Ok(new { result, Message = "Thesis Ingestion successfully completed and added to knowledge of MonteAI." });
        }
        [HttpPut("update/details/{id}")]
        [Authorize(Roles = "Student,Admin")]
        public async Task<IActionResult> UpdateThesisDetails([FromBody] UpdateThesisDto dto, Guid id)
        {
            var uid = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(uid)) return Unauthorized();

            try
            {
                var result = await _service.UpdateDetailsAsync(id, dto, uid, User.IsInRole("Admin"));
                if (result is false) return StatusCode(500, "An error occurred while updating.");

                _logger.LogInformation("Thesis Details with Id: {id} updated successfully", id);
                return Ok(new { Message = "Thesis Details Updated Successfully" });
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (KeyNotFoundException) { return NotFound(new { Message = "Thesis not found." }); }
            catch (InvalidOperationException ex)
            {
                // Rejected before anything persisted (e.g. abstract store down).
                _logger.LogWarning(ex, "Thesis details update rejected for {ThesisId}", id);
                return BadRequest(new { Message = ex.Message });
            }
        }
        [HttpPatch("update/status/{id}")]
        [Authorize(Policy = "Reviewer")]
        public async Task<IActionResult> UpdateThesisStatus([FromBody] UpdateThesisStatusDto dto, Guid id)
        {
            var result = await _service.UpdateStatusAsync(id, dto);

            if (result is false) return StatusCode(500, "An error occurred while updating.");

            _logger.LogInformation("Thesis Status with Id: {id} successfully Updated", id);
            return Ok(new { Message = "ThesisDetails Updated Successfully" });
        }

        [HttpDelete("delete/{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteThesis(Guid id)
        {
            var result = await _service.DeleteAsync(id);

            if (result is false) return StatusCode(500);
            _logger.LogInformation("Thesis with Id: {id} successfully deleted", id);

            return Ok(new { Message = $"Thesis {id} Deleted Successfully" });
        }

        [HttpGet("{id}/download-url")]
        public async Task<IActionResult> GetDownloadUrl(Guid id)
        {
            try
            {
                var url = await _service.GetDownloadUrlAsync(id);
                _logger.LogInformation("Endpoint is called and the Url is is: {url}", url);
                if (string.IsNullOrEmpty(url)) return NotFound();
                _logger.LogInformation("Thesis with id: {id} Fetched Url: {Url}", id, url);
                return Ok(new { url });
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Error Happening: {errorMessage}", ex.Message);
                return BadRequest("Error ngani");
            }
        }

        // ThesisVersion Controllers
        [HttpGet("{thesisId}/versions")]
        public async Task<IActionResult> GetThesisVersions(Guid thesisId)
        {
            try
            {
                var result = await _service.GetByVersionsAsync(thesisId);
                _logger.LogInformation("Retrieved {count} Thesis Versions", result.Count());

                return Ok(new { success = true, result });

            }
            catch (Exception ex)
            {
                _logger.LogWarning("Error fetching thesis Versions {error}", ex.Message);
                return BadRequest("Error Fetching...");
            }
        }

        [HttpGet("versions/single/{versionId}")]
        public async Task<IActionResult> GetThesisVersionById(Guid versionId)
        {
            var result = await _service.GetByVersionIdAsync(versionId);
            if (result == null) return NotFound();
            return Ok(result);
        }

        [HttpGet("versions/{versionId}/download-url")]
        public async Task<IActionResult> GetVersionDownloadUrl(Guid versionId)
        {
            var version = await _service.GetByVersionIdAsync(versionId);
            if (version == null) return NotFound();

            var url = _blobService.GenerateSasUrl(version.FilePath, 15);
            Console.WriteLine(url);
            if (string.IsNullOrEmpty(url)) return NotFound();

            return Ok(new { url });
        }

        [HttpGet("{thesisId}/versions/latest")]
        public async Task<IActionResult> GetLatestThesisVersion(Guid thesisId)
        {
            var result = await _service.GetLatestThesisIdAsync(thesisId);
            if (result == null) return NotFound();
            return Ok(result);
        }

        [HttpPost("{thesisId}/versions")]
        [Authorize(Roles = "Student")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> CreateThesisVersion(Guid thesisId, [FromForm] CreateThesisVersionDto dto)
        {
            if (dto.File == null)
                return BadRequest("File is required.");

            var pdfError = await ValidatePdfAsync(dto.File);
            if (pdfError != null)
                return BadRequest(pdfError);

            var uploadedById = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(uploadedById))
                return Unauthorized();

            string? blobUrl = null;
            try
            {
                await using var stream = dto.File.OpenReadStream();

                var thesisTitle = (await _service.GetByIdAsync(thesisId))?.Title;
                blobUrl = await _blobService.UploadAsync(
                    stream,
                    dto.File.FileName,
                    dto.File.ContentType,
                    thesisTitle // keep revision blobs named after the thesis title
                );

                dto.ThesisId = thesisId;
                dto.FilePath = blobUrl;

                var result = await _service.CreateThesisVersion(dto, uploadedById);
                if (!result) return StatusCode(500, "Failed to create thesis version.");

                _logger.LogInformation("Thesis version created for ThesisId: {ThesisId} by UserId: {UserId}", thesisId, uploadedById);
                return Ok(new { Message = "Thesis version created successfully." });
            }

            catch (UnauthorizedAccessException ex)
            {
                if (blobUrl != null) await TryDeleteUploadedBlobAsync(blobUrl);
                _logger.LogWarning(ex, "Unauthorized thesis revision attempt for ThesisId: {ThesisId} by UserId: {UserId}", thesisId, uploadedById);
                return Forbid();
            }
            catch (InvalidOperationException ex)
            {
                // Rejected after upload (year gate, missing thesis…) — roll the blob back.
                if (blobUrl != null) await TryDeleteUploadedBlobAsync(blobUrl);

                _logger.LogWarning(
            ex,
            "Thesis revision rejected for ThesisId: {ThesisId}",
            thesisId
        );

                return BadRequest(new
                {
                    Message = ex.Message
                });
            }
            catch
            {
                if (blobUrl != null) await TryDeleteUploadedBlobAsync(blobUrl);
                throw;
            }
        }

        [HttpDelete("versions/{thesisId}")]
        public async Task<IActionResult> DeleteThesisVersion(Guid thesisId)
        {
            var uid = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(uid)) return Unauthorized();

            try
            {
                var result = await _service.DeleteThesisVersion(thesisId, uid, User.IsInRole("Admin"));
                if (!result) return StatusCode(500, "Failed to delete thesis versions.");

                _logger.LogInformation("Older versions of thesis {ThesisId} deleted by {Uid}", thesisId, uid);
                return Ok(new { Message = "Older versions deleted successfully." });
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (KeyNotFoundException) { return NotFound(new { Message = "Thesis not found." }); }
        }

        // Deletes a SINGLE version — latest-only (3→2→1). Deleting the final
        // remaining version cascades into deleting the whole thesis.
        [HttpDelete("{thesisId}/versions/{versionId}")]
        [Authorize(Roles = "Student,Admin")]
        public async Task<IActionResult> DeleteThesisVersionById(Guid thesisId, Guid versionId)
        {
            var uid = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(uid)) return Unauthorized();

            try
            {
                var result = await _service.DeleteThesisVersionById(thesisId, versionId, uid, User.IsInRole("Admin"));
                if (!result) return StatusCode(500, "Failed to delete the thesis version.");

                _logger.LogInformation("Version {VersionId} of thesis {ThesisId} deleted by {Uid}", versionId, thesisId, uid);
                return Ok(new { Message = "Thesis version deleted successfully." });
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (KeyNotFoundException ex) { return NotFound(new { Message = ex.Message }); }
            catch (InvalidOperationException ex) { return BadRequest(new { Message = ex.Message }); }
        }

    }
}