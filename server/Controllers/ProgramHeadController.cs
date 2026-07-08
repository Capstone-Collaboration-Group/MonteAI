using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using server.Models.DTOs.ProgramHead;
using server.Models.DTOs.User;
using server.Services.Interfaces;
    
namespace server.Controllers 
{ 
    [ApiController]
    [Route("api/v1/[controller]")]
    public class ProgramHeadController 
    (
        IProgramHeadService _service,
        ILogger<ProgramHeadController> _logger
    ): ControllerBase 
    {
        [HttpGet]
        public async Task<IActionResult> GetAllProgramHeads()
        {
            var result = await _service.GetAllAsync();

            if (result is null) return BadRequest("Bad Request. Try Again Later");

            _logger.LogInformation("Fetched {count} ProgramHeads", result.Count());
            return Ok(result);
        }
        [HttpGet("{id}")]
        public async Task<IActionResult> GetProgramHeadById(string id)
        {
            var result = await _service.GetByIdAsync(id);
            if (result is null) return NotFound(new { Message = "ProgramHead Not Found" });

            _logger.LogInformation("Fetched ProgramHead with Id: {Id}", result.Id);
            return Ok(result);
        }
        [HttpPost("create")]
        public async Task<IActionResult> CreateProgramHead([FromBody] RegisterUserDto dto)
        {
            var result = await _service.CreateAsync(dto);

            if (result)
            {
                _logger.LogInformation("{result} Registered Program Head", result);

                return Ok(new { Message = "Program Head Created Successfully... " });
            }
            
            return BadRequest(new { Message = "Bad Request... Please try again later...", result });
        }
        [HttpPost("update/{id}")]
        public async Task<IActionResult> UpdateProgramHead([FromBody] UpdateProgramHeadDto dto, string id)
        {
            var result = await _service.UpdateAsync(dto, id);
            if(result)
            {
                _logger.LogInformation("Performed Updated on ProgramHead {Name}", dto.FirstName);
                return Ok(new { Message = "Program Head Updated Successfully", result });
            }
            return BadRequest(new { Message = "Bad Request... Please try again later... ", result });
        }
        [HttpPost("delete/{id}")]
        public async Task<IActionResult> DeleteProgramHead(string id)
        {
            var result = await _service.DeleteAsync(id);
            if(result)
            {
                _logger.LogInformation("Performed Deletion on ProgramHead: {id}", id);
                return Ok(new { Message = $"Program Head {id} deleted successfully... ", result });
            }
            return BadRequest(new { Message = "Bad Request... Please try again later... ", result });
        }
    }
}