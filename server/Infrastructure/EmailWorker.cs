// server/Infrastructure/EmailWorker.cs
//
// Background consumer of EmailQueue — the async half of the email pipeline:
//
//   request handler ──> IEmailService.Queue(...) ──> THIS WORKER
//                                                    connect SMTP (MailKit)
//                                                    send, retry w/ backoff
//
// Each job retries up to Email:MaxAttempts times with exponential backoff
// (2s, 4s, …); a job that exhausts its retries is logged and dropped — a
// transient SMTP outage must never crash the host, and these emails are
// informational (a lost one is recoverable by the user acting again).
//
// Registered via AddHostedService in Program.cs (singleton, outside Scrutor).

using Microsoft.Extensions.Options;
using server.Configuration;
using server.Services.Interfaces;

namespace server.Infrastructure
{
    public sealed class EmailWorker : BackgroundService
    {
        private readonly IEmailQueue _queue;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly EmailOptions _options;
        private readonly ILogger<EmailWorker> _logger;

        public EmailWorker(
            IEmailQueue queue,
            IServiceScopeFactory scopeFactory,
            IOptions<EmailOptions> options,
            ILogger<EmailWorker> logger)
        {
            _queue = queue;
            _scopeFactory = scopeFactory;
            _options = options.Value;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Email worker started (enabled: {Enabled})", _options.Enabled);

            var inFlight = new List<Task>();
            try
            {
                await foreach (var job in _queue.DequeueAllAsync(stoppingToken))
                {
                    var task = SendWithRetriesAsync(job, stoppingToken);
                    inFlight.Add(task);
                    inFlight.RemoveAll(t => t.IsCompleted);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Host shutdown — fall through to drain in-flight jobs.
            }

            try { await Task.WhenAll(inFlight); }
            catch { /* individual failures are already handled + logged */ }

            _logger.LogInformation("Email worker stopped");
        }

        private async Task SendWithRetriesAsync(EmailJob job, CancellationToken ct)
        {
            var maxAttempts = Math.Max(1, _options.MaxAttempts);

            for (var attempt = 1; attempt <= maxAttempts; attempt++)
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();

                    await emailService.SendAsync(job, ct);
                    return;
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                    _logger.LogInformation(
                        "Email \"{Subject}\" interrupted by shutdown — dropped (informational mail, not recovered)",
                        job.Subject);
                    throw;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex,
                        "Email to {To} \"{Subject}\" failed (attempt {Attempt}/{Max})",
                        job.To, job.Subject, attempt, maxAttempts);

                    if (attempt >= maxAttempts)
                    {
                        _logger.LogError(ex,
                            "Dropping email to {To} \"{Subject}\" after {Max} attempts",
                            job.To, job.Subject, maxAttempts);
                        return;
                    }

                    try
                    {
                        await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, attempt)), ct);
                    }
                    catch (OperationCanceledException) when (ct.IsCancellationRequested)
                    {
                        throw;
                    }
                }
            }
        }
    }
}
