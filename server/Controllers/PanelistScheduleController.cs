using System;
using Microsoft.AspNetCore.Mvc;
using server.Models.DTOs.PanelistSchedule;
using server.Models.DTOs.User;
using server.Services.Interfaces;
    
namespace server.Controllers 
{ 
    [ApiController]
    [Route("api/v1/[controller]")]
    public class PanelistScheduleController 
    (
        IPanelistScheduleService _service,
        ILogger<PanelistScheduleController> _logger
    ): ControllerBase
    {
        [HttpGet("details")]
        public async Task<IActionResult> GetAllPanelistSchedules()  
        {
            var result = await _service.GetAllAsync();
            if (result is null) return BadRequest(new { Message = "Bad Request... Try Again Later" });

            return Ok(result);
        }
        [HttpGet("{scheduleId}")]
        public async Task<IActionResult> GetPanelistScheduleById(Guid scheduleId, string panelistId)
        {
            var result = await _service.GetByIdAsync(scheduleId, panelistId);
            if (result is null) return NotFound(new { Message = $"Panelist Schedule: {scheduleId} is not found" });

            _logger.LogInformation("Fetched PanelistSchedule Id: {scheduleId} with Panelist: {panelistId}", result.ScheduleId, result.PanelistId);

            return Ok(result);
        }
        [HttpPost("create")]
        public async Task<IActionResult> CreatePanelistSchedule([FromBody] CreatePanelistScheduleDto dto)
        {
            var result = await _service.CreateAsync(dto);
            if(result)
            {
                _logger.LogInformation("Created Panelist Schedule");
                return Ok(new { Message = "Created Panelist Schedule ", result });
            }
            return BadRequest(new { Message = "Bad Request... Please try again later..." });
        }
        [HttpPatch("update/{scheduleId}")]
        public async Task<IActionResult> UpdatePanelistSchedule([FromBody] UpdatePanelistScheduleDto dto, Guid scheduleId, string panelistId)
        {
            var result = await _service.UpdateAsync(dto, scheduleId, panelistId);
            if(result)
            {
                _logger.LogInformation("Performed update on PanelistSchedule Id: {id}", scheduleId);
                return Ok(new { Message = "Panelist Schedule Updated Successfully" });
            }
            return BadRequest(new { Message = "Bad Request... Please Try again later" });
        }
        [HttpDelete("delete/{scheduleId}&{panelistId}")]
        public async Task<IActionResult> DeletePanelistSchedule(Guid scheduleId, string panelistId)
        {
            var result = await _service.DeleteAsync(scheduleId, panelistId);
            if(result)
            {
                _logger.LogInformation("PanelistSchedule Deleted Successfully...");
                return Ok(new { Message = "Panelist Schedule Deleted Successfully" });
            }
            return BadRequest(new { Message = "Bad Request... Try again later..." });
        }
                  
    }
}