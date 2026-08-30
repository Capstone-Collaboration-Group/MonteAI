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
            if (result == null) return NotFound();
            return Ok(result);
        }

        [HttpPost("submit")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> SubmitThesis([FromForm] SubmitThesisDto dto)
        {
            if (dto.File == null)
                return BadRequest("File is required");

            await using var stream = dto.File.OpenReadStream();

            var blobUrl = await _blobService.UploadAsync(
                    stream,
                    dto.File.FileName,
                    dto.File.ContentType
                );

            dto.FilePath = blobUrl;
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

            if (result is false) return StatusCode(500, "An error occurred while updating.");

            _logger.LogInformation("Thesis Details with Id: {id} updated successfully", id);
            return Ok(new { Message = "Thesis Details Updated Successfully" });
        }
        [HttpPatch("update/status/{id}")]
        public async Task<IActionResult> UpdateThesisStatus([FromBody] UpdateThesisStatusDto dto, Guid id)
        {
            var result = await _service.UpdateStatusAsync(id, dto);

            if (result is false) return StatusCode(500, "An error occurred while updating.");

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
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> CreateThesisVersion(Guid thesisId, [FromForm] CreateThesisVersionDto dto)
        {
            if (dto.File == null)
                return BadRequest("File is required.");

            var uploadedById = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(uploadedById))
                return Unauthorized();
            await using var stream = dto.File.OpenReadStream();
            var blobUrl = await _blobService.UploadAsync(
                stream,
                dto.File.FileName,
                dto.File.ContentType
            );

            dto.ThesisId = thesisId;
            dto.FilePath = blobUrl; 

            var result = await _service.CreateThesisVersion(dto, uploadedById);
            if (!result) return StatusCode(500, "Failed to create thesis version.");

            _logger.LogInformation("Thesis version created for ThesisId: {ThesisId} by UserId: {UserId}", thesisId, uploadedById);
            return Ok(new { Message = "Thesis version created successfully." });
        }

        [HttpDelete("versions/{versionId}")]
        public async Task<IActionResult> DeleteThesisVersion(Guid versionId)
        {
            var result = await _service.DeleteThesisVersion(versionId);
            if (!result) return StatusCode(500, "Failed to delete thesis version.");

            _logger.LogInformation("Thesis version {VersionId} deleted successfully", versionId);
            return Ok(new { Message = $"Thesis version {versionId} deleted successfully." });
        }

    }
}