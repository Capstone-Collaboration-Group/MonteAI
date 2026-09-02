using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using server.Models.DTOs.ResearchGroup;
using server.Services.Interfaces;

namespace server.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class ResearchGroupController
    (
        IResearchGroupService _service,
        ILogger<ResearchGroupController> _logger
    ) : ControllerBase
    {
        [HttpGet]
        public async Task<IActionResult> GetAllResearchGroups()
        {
            var result = await _service.GetAllAsync();

            if (result is null) return BadRequest("Bad Request. Try Again Later");

            _logger.LogInformation("Fetched {count} ResearchGroups", result.Count());
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetResearchGroupById(Guid id)
        {
            var result = await _service.GetByIdAsync(id);

            if (result is null)
                return NotFound(new { Message = "Research Group Not Found" });

            _logger.LogInformation("Fetched ResearchGroup with Id: {Id}", result.Id);
            return Ok(result);
        }

        [HttpPost("create")]
        public async Task<IActionResult> CreateResearchGroup([FromBody] CreateResearchGroupDto dto)
        {
            var result = await _service.CreateAsync(dto);

            if (result)
            {
                _logger.LogInformation("Created Research Group: {GroupName}", dto.GroupName);

                return Ok(new
                {
                    Message = "Research Group Created Successfully...",
                    result
                });
            }

            return BadRequest(new
            {
                Message = "Bad Request... Please try again later...",
                result
            });
        }

        [HttpPatch("update/{id}")]
        public async Task<IActionResult> UpdateResearchGroup([FromBody] UpdateResearchGroupDto dto, Guid id)
        {
            var result = await _service.UpdateAsync(id, dto);

            if (result)
            {
                _logger.LogInformation("Updated Research Group: {Id}", id);

                return Ok(new
                {
                    Message = "Research Group Updated Successfully",
                    result
                });
            }

            return BadRequest(new
            {
                Message = "Bad Request... Please try again later...",
                result
            });
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> DeleteResearchGroup(Guid id)
        {
            var result = await _service.DeleteAsync(id);

            if (result)
            {
                _logger.LogInformation("Performed Deletion on ResearchGroup: {Id}", id);

                return Ok(new
                {
                    Message = $"Research Group {id} deleted successfully...",
                    result
                });
            }

            return BadRequest(new
            {
                Message = "Bad Request... Please try again later...",
                result
            });
        }
    }
}