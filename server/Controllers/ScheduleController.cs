
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using server.Models.DTOs.Schedule;
using server.Models.Exceptions;
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
        /// <summary>
        /// Roles the scheduling UI offers — and the only ones the proceedings
        /// print in Section II. Null/empty is allowed for legacy rows.
        /// </summary>
        private static readonly string[] PanelRoles =
        {
            "Panel Chairperson",
            "Panel Member",
            "Capstone Adviser",
        };

        private static string? FindInvalidPanelRole(IEnumerable<string?> roles) =>
            roles
                .Where(role => !string.IsNullOrWhiteSpace(role))
                .Select(role => role!.Trim())
                .FirstOrDefault(role => !PanelRoles.Contains(role, StringComparer.OrdinalIgnoreCase));


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
        [Authorize(Roles = "Admin,ProgramHead")]
        public async Task<IActionResult> CreateSchedule([FromBody] CreateScheduleDto dto)
        {
            var badRole = FindInvalidPanelRole(dto.Panelists.Select(p => p.Role));
            if (badRole != null)
                return BadRequest(new
                {
                    Message = $"Unknown panel role \"{badRole}\". Expected one of: {string.Join(", ", PanelRoles)}.",
                });

            try
            {
                var result = await _service.CreateAsync(dto);
                if(result)
                {
                    _logger.LogInformation("Schedule Created Successfully");
                    return Ok(new { Message = "Schedule Created Successfully", result });
                }

                return BadRequest(new { Message = "That timeslot is taken, or one of the panelists is already booked that day.", result });
            }
            catch (ScheduleAlreadyExistsException ex)
            {
                _logger.LogWarning(ex, "Rejected duplicate schedule for research group {GroupId}", ex.GroupId);
                return Conflict(new { Message = ex.Message });
            }
        }
        [HttpPatch("update/{id}")]
        [Authorize(Roles = "Admin,ProgramHead")]
        public async Task<IActionResult> UpdateSchedule([FromBody] UpdateScheduleDto dto, Guid id)
        {
            if (dto.Panelists != null)
            {
                var badRole = FindInvalidPanelRole(dto.Panelists.Select(p => p.Role));
                if (badRole != null)
                    return BadRequest(new
                    {
                        Message = $"Unknown panel role \"{badRole}\". Expected one of: {string.Join(", ", PanelRoles)}.",
                    });
            }

            var result = await _service.UpdateAsync(dto, id);
            if(result)
            {
                _logger.LogInformation("Performed Schedule Update on Id: {id}", id);
                return Ok(new { Message = "Schedule Update Successful " });
            }
            return BadRequest(new { Message = "Bad Request... A schedule has already occupied that timeslot or one of the panelists is already booked that day" });
        }
        [HttpPatch("update-times/{id}")]
        [Authorize(Roles = "Admin,ProgramHead")]
        public async Task<IActionResult> UpdateScheduleTimes([FromBody] UpdateScheduleTimesDto dto, Guid id)
        {
            var result = await _service.UpdateTimesAsync(id, dto);
            if (result)
            {
                _logger.LogInformation("Performed Schedule Time Update on Id: {id}", id);
                return Ok(new { Message = "Schedule Time Update Successful " });
            }
            return BadRequest(new { Message = "Bad Request... A schedule has already occupied that timeslot or one of the panelists is already booked that day" });
        }
        [HttpDelete("delete/{id}")]
        [Authorize(Roles = "Admin,ProgramHead")]
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
