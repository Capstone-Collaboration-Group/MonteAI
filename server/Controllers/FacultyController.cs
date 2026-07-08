using System;
using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using server.Models.DTOs.Faculty;
using server.Models.DTOs.User;
using server.Models.Entities;
using server.Services.Interfaces;
    
namespace server.Controllers 
{ 
    [ApiController]
    [Route("api/v1/[controller]")]
    public class FacultyController 
    (   IFacultyService _service,
        ILogger<FacultyController> _logger
    ) : ControllerBase 
    {
        [HttpGet]
        public async Task<IActionResult> GetAllFaculties()
        {
            var result = await _service.GetAllAsync();
            if (result is null) return BadRequest("Bad Request. Try Again Later...");

            _logger.LogInformation("Fetched {count} Faculties", result.Count());
            return Ok(result);
        }
        [HttpGet("{id}")]
        public async Task<IActionResult> GetFacultyById(string id)
        {
            var result = await _service.GetByIdAsync(id);
            if (result is null) return NotFound($"Faculty with Id {id} is not found");

            _logger.LogInformation("Faculty With Id {id} fetched.", result.Id);
            return Ok(result);

        }
        // No Faculty Creation POST Method since it will be handled in the registration Authcontroller

        [HttpPatch("update/{id}")]
        public async Task<IActionResult> UpdateFaculty([FromBody] UpdateUserDto dto, string id)
        {
            var result = await _service.UpdateAsync(dto, id);
            _logger.LogInformation("Performed Updating of Faculty: {Name} ", dto.FirstName);
            if (result)
            {
                _logger.LogInformation("Faculty Updated Successfully");
                return Ok(new { Message = "Faculty Updated Successfully", result });
            }
            return BadRequest(new {Message = "Faculty Update Not Successful", result});
        }
        [HttpDelete("delete{id}")]
        public async Task<IActionResult> DeleteFaculty(string id)
        {
            var result = await _service.DeleteAsync(id);
            if (result)
            {
                _logger.LogInformation("Faculty Deleted Successfully");
                return Ok(new { Message = "Faculty Deleted Successfully", result });
            }
            return BadRequest(new { Message = "Faculty Delete Not Successful", result });
        }
    }
}