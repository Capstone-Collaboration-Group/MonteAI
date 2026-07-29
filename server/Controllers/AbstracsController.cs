using Microsoft.AspNetCore.Mvc;
using server.Models.Retrieval;
using server.Services.Interfaces;

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
        [HttpPost("upsert/{id}")]
        public async Task<IActionResult> UpsertAbstract(string id, [FromBody] Chunk chunk)
        {
            if (chunk == null) return BadRequest("Chunk Payload cannot be null");
            bool success = await _pineconeService.UpsertAbstractAsync(id, chunk);
            if (success)
            {
                return Ok(new { Message = $"Abstract Id {id} successfully upserted to pinecone " });
            }
            return StatusCode(500, new { Error = $"Failed to upsert abstract '{id}' into Pinecone. Check server logs." });
        }
    }
}
