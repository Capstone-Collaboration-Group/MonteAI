using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using server.Models.DTOs.User;
using server.Services.Interfaces;
    
namespace server.Controllers 
{ 
    [ApiController]
    [Route("api/v1/[controller]")]
    public class PanelistScheduleController : ControllerBase {

    //<-- Inherited from Microsoft.AspNetCore.Mvc
    private readonly ILogger<PanelistScheduleController> _logger;

    // Constructor
    public PanelistScheduleController(ILogger<PanelistScheduleController> logger) { 
        _logger = logger;
    }
}
}