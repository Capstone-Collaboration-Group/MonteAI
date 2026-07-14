using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Logging;
using server.Models.DTOs.User;
using server.Services.Interfaces;
    
namespace server.Controllers 
{ 
    [ApiController]
    [Route("api/v1/[controller]")]
    [EnableRateLimiting("HealthCheckLimit")]
    public class AdminController
    (
        IAdminService _service,
        ILogger<AdminController> _logger
    )　: ControllerBase 
    {
        [HttpGet]
        public async Task<IActionResult> GetAllAdmins()
        {
            var result = await _service.GetAllAsync();
            if (result is null) return BadRequest("Request Timeout... Try Again Later");

            _logger.LogInformation("Fetched {count} Admins", result.Count());
            return Ok(result);
        }
        [HttpGet("{id}")]
        public async Task<IActionResult> GetAdminById(string id)
        {
            var result = await _service.GetByIdAsync(id);
            if (result is null) return NotFound($"Admin {id} is not found");

            _logger.LogInformation("Fetched Admin Admin: {Id}", id);
            return Ok(result);
        }
        [HttpPatch("update/{id}")]
        public async Task<IActionResult> UpdateAdmin(UpdateUserDto dto)
        {
            var result = await _service.UpdateAsync(dto);
            _logger.LogInformation("Performed Update on Admin {FirstName}", dto.FirstName);
            if (result) return Ok(new {Message = "Admin Updated Successfully...", result});

            return BadRequest(new { Message = "Update Not Sucessfull... Try again Later", result });

            
        }
        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> DeleteAdmin(string id)
        {
            var result = await _service.DeleteAsync(id);
            _logger.LogInformation("Performing Delete Query on Admin: {id}", id);
            if (result) return Ok(new { Message = "Admin Deleted Successfull...", result });

            return BadRequest(new { Message = "Admin Deletion Not Successfull", result });
        }

    }
}