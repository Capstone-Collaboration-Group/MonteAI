using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using server.Models.DTOs.Analytics;
using server.Services.Interfaces;

// server/Controllers/AnalyticsController.cs
//
// Query & Activity Monitoring API:
//   GET /api/v1/analytics/overview?days=30   (Admin) — dashboard rollups
//   GET /api/v1/analytics/suggestions?limit=6        — top query strings for chat suggestion cards
//
// Events are recorded elsewhere (ChatController → chat_query,
// ThesisController → catalog_search / thesis_view) — see
// IAnalyticsService.RecordAsync. Download statistics are intentionally never
// recorded or displayed (users/students may not download theses).
namespace server.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class AnalyticsController : ControllerBase
    {
        private readonly IAnalyticsService _analytics;
        private readonly ILogger<AnalyticsController> _logger;

        public AnalyticsController(IAnalyticsService analytics, ILogger<AnalyticsController> logger)
        {
            _analytics = analytics;
            _logger = logger;
        }

        /// <summary>Dashboard monitoring: totals + top queries + top accessed theses.</summary>
        [HttpGet("overview")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetOverview([FromQuery] int days = 30, CancellationToken cancellationToken = default)
        {
            var overview = await _analytics.GetOverviewAsync(days, cancellationToken);
            _logger.LogInformation("Fetched analytics overview ({Days}-day window)", overview.RangeDays);
            return Ok(overview);
        }

        /// <summary>Most frequent chat/catalog queries — powers the suggestion cards on every chat surface.</summary>
        [HttpGet("suggestions")]
        public async Task<IActionResult> GetSuggestions([FromQuery] int limit = 6, CancellationToken cancellationToken = default)
        {
            var suggestions = await _analytics.GetSuggestionsAsync(limit, 30, cancellationToken);
            return Ok(new AnalyticsSuggestionsDto { Suggestions = suggestions.ToList() });
        }
    }
}
