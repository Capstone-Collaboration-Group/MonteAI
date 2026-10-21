using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using server.Models.Retrieval;
using server.Services.Interfaces;

// server/Controllers/AbstracsController.cs
//
// Low-level debug/admin endpoint for a direct Pinecone metadata-vector
// upsert, bypassing the normal ingestion pipeline. Normal ingestion should go
// through POST /api/v1/thesis/ingest (ThesisService.IngestAsync), which also
// handles idempotent deletion, SQL status updates, and metadata resolution.

namespace server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class AbstracsController
        (
        IPineconeService _pineconeService,
        ILogger<AbstracsController> _logger
        ) : ControllerBase
    {
        // Upserts the single metadata vector (thesis_{id}_meta) from a raw
        // Chunk payload. Same vector IngestAsync writes — debug use only.
        [HttpPost("upsert/{thesisId:guid}")]
        public async Task<IActionResult> UpsertMetadata(Guid thesisId, [FromBody] Chunk chunk)
        {
            if (chunk is null || string.IsNullOrWhiteSpace(chunk.Text))
                return BadRequest("A chunk with text is required.");

            var upserted = await _pineconeService.UpsertMetadataChunkAsync(thesisId, chunk);
            if (upserted > 0)
            {
                _logger.LogInformation("Direct metadata upsert for thesis {ThesisId}", thesisId);
                return Ok(new { Message = $"Metadata vector for thesis {thesisId} upserted to Pinecone." });
            }
            return StatusCode(500, new { Error = $"Failed to upsert the metadata vector for thesis {thesisId} into Pinecone. Check server logs." });
        }
    }
}
