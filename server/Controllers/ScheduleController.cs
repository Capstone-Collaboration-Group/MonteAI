
using Microsoft.AspNetCore.Mvc;

using server.Models.DTOs.Schedule;
using server.Models.Entities;
using server.Services.Interfaces;

namespace server.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class ScheduleController
    (
        IScheduleService _service,
        ILogger<ScheduleController> _logger
    ): ControllerBase
    {
        [HttpGet]
        public async Task<IActionResult> GetAllSchedules()
        {
            var result = await _service.GetAllAsync();
            if (result is null) return BadRequest(new { Message = "Bad Request... Please try again later" });

            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetScheduleById(Guid id)
        {
            var result = await _service.GetByIdAsync(id);
            if (result is null) return NotFound(new { Message = "Schedule is not Found" });

            _logger.LogInformation("Fetched Scheduel with Id: {id}", id);
            return Ok(result);
        }
        [HttpPost("create")]
        public async Task<IActionResult> CreateSchedule([FromBody] CreateScheduleDto dto)
        {
            var result = await _service.CreateAsync(dto);
            if(result)
            {
                _logger.LogInformation("Schedule Created Successfully");
                return Ok(new { Message = "Schedule Created Successfully", result });
            }
            return BadRequest(new { Message = "Bad Request or There is a Schedule for that timeslot... Try again later... ", result });
        }
        [HttpPatch("update/{id}")]
        public async Task<IActionResult> UpdateSchedule([FromBody] UpdateScheduleDto dto, Guid id)
        {
            var result = await _service.UpdateAsync(dto, id);
            if(result)
            {
                _logger.LogInformation("Performed Schedule Update on Id: {id}", id);
                return Ok(new { Message = "Schedule Update Successful " });
            }
            return BadRequest(new { Message = "Bad Request... A schedule has already occupied that timeslot" });
        }
        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> DeleteSchedule(Guid id)
        {
            var result = await _service.DeleteAsync( id);
            if (result)
            {
                _logger.LogInformation("Performed Schedule Deletion  on Id: {id}", id);
                return Ok(new { Message = "Schedule Deletion Successful " });
            }
            return BadRequest(new { Message = "Bad Request... Please try again later" });
        }


    }
}
