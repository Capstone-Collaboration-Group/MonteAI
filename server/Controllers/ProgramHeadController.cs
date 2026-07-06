using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using server.Models.DTOs.User;
using server.Services.Interfaces;
    
namespace server.Controllers 
{ 
    [ApiController]
    [Route("api/v1/[controller]")]
    public class ProgramHeadController : ControllerBase {

    //<-- Inherited from Microsoft.AspNetCore.Mvc
    private readonly ILogger<ProgramHeadController> _logger;

    // Constructor
    public ProgramHeadController(ILogger<ProgramHeadController> logger) { 
        _logger = logger;
    }
}
}