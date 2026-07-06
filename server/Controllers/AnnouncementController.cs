using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using server.Models.DTOs.User;
using server.Services.Interfaces;
    
namespace server.Controllers 
{ 
    [ApiController]
    [Route("api/v1/[controller]")]
    public class AnnouncementController : ControllerBase {

    //<-- Inherited from Microsoft.AspNetCore.Mvc
    private readonly ILogger<AnnouncementController> _logger;

    // Constructor
    public AnnouncementController(ILogger<AnnouncementController> logger) { 
        _logger = logger;
    }
}
}