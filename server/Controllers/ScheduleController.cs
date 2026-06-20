using Microsoft.AspNetCore.Mvc;
using server.Data;
using server.Models.Entities;

namespace server.Controllers
{
    [ApiController]
    [Route("api[controller]")]
    public class ScheduleController : ControllerBase
    {

        private readonly AppDbContext _context;
        private readonly ILogger<ScheduleController> _logger;

        public ScheduleController(AppDbContext context, ILogger<ScheduleController> logger)
        {
            _context = context;
            _logger = logger;
        }
        [HttpGet]
        public async Task<IActionResult> CreateSchedule()
        {
            

            Schedule schedule = new Schedule()
            {
                Date = new DateOnly(),
                GroupId = Guid.NewGuid(),
                ResearchGroup = new ResearchGroup() { Id = Guid.NewGuid() },
                StartTime = new TimeOnly(),
                EndingTime = new TimeOnly(),
                Panelists = new List<PanelistSchedule>(),
                RoomVenue = "Comlab 1",
                ScheduledBy = "Admin",
                ScheduleId = Guid.NewGuid(),
                AdditionalInformation = "Test schedule"
            };

            await _context.Schedules.AddAsync(schedule);
            await _context.SaveChangesAsync();


            _logger.LogInformation($"Schedule {schedule} has been successfully saved");
            return Ok(schedule);


        }
    }
}
