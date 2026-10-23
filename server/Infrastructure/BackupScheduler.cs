using Microsoft.Extensions.Options;
using server.Configuration;
using server.Services.Interfaces;

namespace server.Infrastructure
{
    // Option 5 of the backup plan: a full data copy written on a schedule,
    // server-side, without the desktop app being open.
    //
    // The first run happens one IntervalHours AFTER startup (no surprise burst
    // of blob traffic on boot). Disabled by default — see the "Backup" section
    // in appsettings*.json. Each run writes backup_<stamp>/{data.zip, files/,
    // manifest.json} into OutputFolder and prunes old sets beyond KeepCount.
    public class BackupScheduler : BackgroundService
    {
        private readonly IOptions<BackupOptions> _options;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<BackupScheduler> _logger;

        public BackupScheduler(
            IOptions<BackupOptions> options,
            IServiceScopeFactory scopeFactory,
            ILogger<BackupScheduler> logger)
        {
            _options = options;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                var options = _options.Value;
                var intervalHours = Math.Max(1, options.Scheduled.IntervalHours);

                try
                {
                    await Task.Delay(TimeSpan.FromHours(intervalHours), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }

                var scheduled = options.Scheduled;
                if (!scheduled.Enabled || string.IsNullOrWhiteSpace(scheduled.OutputFolder))
                {
                    _logger.LogDebug("Scheduled backup skipped (disabled or no output folder)");
                    continue;
                }

                try
                {
                    var categories = scheduled.Categories.ToList();
                    if (scheduled.IncludeBacpac && !categories.Contains(BacpacKey))
                        categories.Add(BacpacKey);

                    using var scope = _scopeFactory.CreateScope();
                    var service = scope.ServiceProvider.GetRequiredService<IBackupService>();
                    await service.WriteScheduledBackupAsync(
                        scheduled.OutputFolder,
                        categories,
                        scheduled.KeepCount,
                        stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Scheduled backup failed");
                }
            }
        }

        private const string BacpacKey = "bacpac";
    }
}
