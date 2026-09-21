using Microsoft.AspNetCore.Mvc;
using server.Models.Retrieval;
using server.Services.Interfaces;

// server/Controllers/AbstracsController.cs
//
// Low-level debug/admin endpoint for direct Pinecone upserts, bypassing the
// desktop ingestion pipeline. Normal ingestion should go through
// POST /api/v1/thesis/ingest (ThesisService.IngestAsync), which also handles
// idempotent deletion, SQL status updates, and metadata overrides.

namespace server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AbstracsController
        (
        IPineconeService _pineconeService,
        ILogger<AbstracsController> _logger
        ): ControllerBase
    {
        [HttpPost("upsert/{thesisId:guid}")]
        public async Task<IActionResult> UpsertAbstract(Guid thesisId, [FromBody] List<Chunk> chunks)
        {
            if (chunks == null || chunks.Count == 0) return BadRequest("Chunk payload cannot be null or empty.");

            var upserted = await _pineconeService.UpsertAbstractsAsync(thesisId, chunks);
            if (upserted > 0)
            {
                return Ok(new { Message = $"{upserted} chunks for thesis {thesisId} successfully upserted to Pinecone." });
            }
            return StatusCode(500, new { Error = $"Failed to upsert abstract chunks for thesis {thesisId} into Pinecone. Check server logs." });
        }
    }
}
