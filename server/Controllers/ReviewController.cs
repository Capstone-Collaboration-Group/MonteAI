using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using server.Models.DTOs.User;
using server.Services.Interfaces;
    
namespace server.Controllers 
{ 
    [ApiController]
    [Route("api/v1/[controller]")]
    public class ReviewController : ControllerBase {

    //<-- Inherited from Microsoft.AspNetCore.Mvc
    private readonly ILogger<ReviewController> _logger;

    // Constructor
    public ReviewController(ILogger<ReviewController> logger) { 
        _logger = logger;
    }
}
}