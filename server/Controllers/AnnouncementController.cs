using System;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using server.Models.DTOs.Announcement;
using server.Models.DTOs.User;
using server.Services.Interfaces;
    
namespace server.Controllers 
{ 
    [ApiController]
    [Route("api/v1/[controller]")]
    public class AnnouncementController : ControllerBase 
    {

        //<-- Inherited from Microsoft.AspNetCore.Mvc
        private readonly ILogger<AnnouncementController> _logger;
        private readonly IAnnouncementService _service;


        // Constructor
        public AnnouncementController(ILogger<AnnouncementController> logger, IAnnouncementService service) { 
            _logger = logger;
            _service = service;
        }
        [HttpGet]
        public async Task<IActionResult> GetAllAnnouncements()
        {
            var result = await _service.GetAllAsync();
            if (result is null) return BadRequest(new { Message = "Bad Request... Please try again later" });
            _logger.LogInformation("Fetched {count} Announcements", result.Count());

            return Ok(result);
        }
        [HttpGet("{id}")]
        public async Task<IActionResult> GetAnnouncementById(Guid id)
        {
            var result = await _service.GetByIdAsync(id);
            if (result is null) return NotFound(new { Message = $"Announcement Id: {id} Not Found" });

            _logger.LogInformation("Fetched Announcement Id: {id}", result.Id);
            return Ok(result);
        }
        [HttpPost("create")]
        public async Task<IActionResult> CreateAnnouncement([FromBody] CreateAnnouncementDto dto)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var role = User.FindFirstValue(ClaimTypes.Role);
            //temporary user and id
            if(string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(role))
            {
                userId = "qZ3mK9vL2nXpR7wT4yB8cF1dA6hD";
                role = "Admin";
            }

            var result = await _service.CreateAsync(dto, userId, role);
            if(result)
            {
                _logger.LogInformation("Created An Announncement Successfully!");
                return Ok(new { Message = "Announcement Created Successfully" });
            }
            return BadRequest(new { Message = "Announcement Creation not successful" });
        }
        [HttpPatch("update/{id}")]
        public async Task<IActionResult> UpdateAnnouncement([FromBody] UpdateAnnouncementDto dto, Guid id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var role = User.FindFirstValue(ClaimTypes.Role);
            //temporary user and id
            if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(role))
            {
                userId = "qZ3mK9vL2nXpR7wT4yB8cF1dA6hD";
                role = "Admin";
            }
            var result = await _service.UpdateAsync(dto, id, userId, role);
            if (result)
            {
                _logger.LogInformation("Updated An Announncement Successfully!");
                return Ok(new { Message = "Announcement Updated Successfully" });
            }
            return BadRequest(new { Message = "Announcement Update not successful" });
        }
        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> DeleteAnnouncement(Guid id)
        {
            var result = await _service.DeleteAsync(id);
            if (result)
            {
                _logger.LogInformation("Deleted An Announncement Successfully!");
                return Ok(new { Message = "Announcement Deleted Successfully" });
            }
            return BadRequest(new { Message = "Announcement Deletion not successful" });
        }
    }

}