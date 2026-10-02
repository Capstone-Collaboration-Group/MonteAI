using System;
using Microsoft.AspNetCore.Mvc;
using server.Models.DTOs.Review;
using server.Services.Interfaces;
    
namespace server.Controllers 
{ 
    [ApiController]
    [Route("api/v1/[controller]")]
    public class ReviewController
    (
        IReviewService _service,
        ILogger<ReviewController> _logger
    ): ControllerBase 
    {

        [HttpGet]
        public async Task<IActionResult> GetAllReviews()
        {
            var result = await _service.GetAllAsync();
            if (result is null) return BadRequest(new { Messge = "Bad Request... Please Try again Later" });

            _logger.LogInformation("Fetched {count} Reviews. ", result.Count());
            return Ok(result);
        }
        [HttpGet("{id}")]
        public async Task<IActionResult> GetReviewById(Guid id)
        {
            var result = await _service.GetByIdAsync(id);
            if (result is null) return NotFound(new { Message = "Review not found." });

            _logger.LogInformation("Fetched Review Id: {id}", id);
            return Ok(result);
        }
        [HttpPost("create")]
        public async Task<IActionResult> CreateReview([FromBody] CreateReviewDto dto)
        {
            var result = await _service.CreateAsync(dto);
            if(result)
            {
                _logger.LogInformation("Created A Review");
                return Ok(new { Message = "Review Created Successfully!" });
            }
            return BadRequest(new { Message = "Bad Request... Please Try again later..." });
        }
        [HttpPatch("update/{id}")]
        public async Task<IActionResult> UpdateReview([FromBody] UpdateReviewDto dto, Guid id)
        {
            var result = await _service.UpdateAsync(dto, id);
            if (result)
            {
                _logger.LogInformation("Updated A Review");
                return Ok(new { Message = "Review Updated Successfully!" });
            }
            return BadRequest(new { Message = "Bad Request... Please Try again later..." });
        }
        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> DeleteReview(Guid id)
        {
            var result = await _service.DeleteAsync(id);
            if (result)
            {
                _logger.LogInformation("Deleted A Review");
                return Ok(new { Message = "Review Deleted Successfully!" });
            }
            return BadRequest(new { Message = "Bad Request... Please Try again later..." });
        }

    }
}