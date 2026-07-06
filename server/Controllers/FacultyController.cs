using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using server.Models.DTOs.User;
using server.Services.Interfaces;
    
namespace server.Controllers 
{ 
    [ApiController]
    [Route("api/v1/[controller]")]
    public class FacultyController : ControllerBase {

    //<-- Inherited from Microsoft.AspNetCore.Mvc
    private readonly ILogger<FacultyController> _logger;

    // Constructor
    public FacultyController(ILogger<FacultyController> logger) { 
        _logger = logger;
    }
}
}