using Google.Cloud.Firestore;
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
        private readonly FirestoreDb _firestoreDb;


        public ScheduleController(AppDbContext context, ILogger<ScheduleController> logger, FirestoreDb firestoreDb)
        {
            _context = context;
            _logger = logger;
            _firestoreDb = firestoreDb;
        }
        [HttpGet]
        public async Task<IActionResult> CreateSchedule()
        {
            var collecton = _firestoreDb.Collection("schedules");

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
            var docData = new Dictionary<string, object>
            {
                {"date", schedule.Date.ToString()},
                {"group_id",  schedule.GroupId.ToString() },
                { "research_group", schedule.ResearchGroup.ToString() },
                { "start_time", schedule.StartTime.ToString() },
                { "ending_time", schedule.EndingTime.ToString()}
            };

            var docRef = await collecton.AddAsync(docData);

            if(docRef == null)
            {
                _logger.LogCritical("document insertion is not successul! try again");
            }

            await _context.Schedules.AddAsync(schedule);
            await _context.SaveChangesAsync();


            _logger.LogInformation($"Schedule {schedule} has been successfully saved");
            return Ok(schedule);


        }
    }
}
