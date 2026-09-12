using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using server.Models.DTOs.ResearchGroup;
using server.Services.Interfaces;

namespace server.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/v1/[controller]")]
    public class ResearchGroupController
    (
        IResearchGroupService _service,
        ILogger<ResearchGroupController> _logger
    ) : ControllerBase
    {
        [HttpGet]
        [Authorize(Roles = "Student,Faculty,ProgramHead,Admin")]
        public async Task<IActionResult> GetAllResearchGroups()
        {
            try
            {
                var result = await _service.GetAllAsync();

                _logger.LogInformation("Fetched {count} ResearchGroups", result.Count());
                return Ok(result);
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
        }

        [HttpGet("{id}")]
        [Authorize(Roles = "Student,Faculty,ProgramHead,Admin")]
        public async Task<IActionResult> GetResearchGroupById(Guid id)
        {
            try
            {
                var result = await _service.GetByIdAsync(id);

                if (result is null)
                    return NotFound(new { Message = "Research Group Not Found" });

                _logger.LogInformation("Fetched ResearchGroup with Id: {Id}", result.Id);
                return Ok(result);
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
        }

        [HttpPost("create")]
        [Authorize(Roles = "Student,Admin")]
        public async Task<IActionResult> CreateResearchGroup([FromBody] CreateResearchGroupDto dto)
        {
            try
            {
                var result = await _service.CreateAsync(dto);

                if (result is null)
                {
                    return Conflict(new
                    {
                        Message = "A research group with the same name, research title, or leader already exists.",
                        result
                    });
                }

                _logger.LogInformation("Created Research Group: {GroupName}", result.GroupName);

                return Ok(new
                {
                    Message = "Research Group Created Successfully...",
                    result
                });
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (KeyNotFoundException)
            {
                return NotFound(new { Message = "Leader student was not found." });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { Message = ex.Message });
            }
        }

        [HttpPatch("update/{id}")]
        [Authorize(Roles = "Student,ProgramHead,Admin")]
        public async Task<IActionResult> UpdateResearchGroup([FromBody] UpdateResearchGroupDto dto, Guid id)
        {
            try
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
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (KeyNotFoundException)
            {
                return NotFound(new { Message = "Research Group Not Found" });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { Message = ex.Message });
            }
        }

        [HttpDelete("delete/{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteResearchGroup(Guid id)
        {
            try
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
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (KeyNotFoundException)
            {
                return NotFound(new { Message = "Research Group Not Found" });
            }
        }

        [HttpPost("{id}/members")]
        [Authorize(Roles = "Student,ProgramHead,Admin")]
        public async Task<IActionResult> AddResearchGroupMember(Guid id, [FromBody] AddResearchGroupMemberDto dto)
        {
            try
            {
                var result = await _service.AddMemberAsync(id, dto.StudentId);

                if (result)
                {
                    _logger.LogInformation("Added student {StudentId} to ResearchGroup {Id}", dto.StudentId, id);
                    return Ok(new { Message = "Member added successfully...", result });
                }

                return Conflict(new
                {
                    Message = "The student was not found or already belongs to a research group.",
                    result
                });
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (KeyNotFoundException)
            {
                return NotFound(new { Message = "Research Group Not Found" });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { Message = ex.Message });
            }
        }

        [HttpDelete("{id}/members/{studentId}")]
        [Authorize(Roles = "Student,ProgramHead,Admin")]
        public async Task<IActionResult> RemoveResearchGroupMember(Guid id, string studentId)
        {
            try
            {
                var result = await _service.RemoveMemberAsync(id, studentId);

                if (result)
                {
                    _logger.LogInformation("Removed student {StudentId} from ResearchGroup {Id}", studentId, id);
                    return Ok(new { Message = "Member removed successfully...", result });
                }

                return NotFound(new { Message = "Member not found in this research group.", result });
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (KeyNotFoundException)
            {
                return NotFound(new { Message = "Research Group Not Found" });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { Message = ex.Message });
            }
        }
    }
}
