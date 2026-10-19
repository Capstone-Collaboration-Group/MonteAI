// server/Services/Email/EmailService.cs
//
// MailKit SMTP transport behind IEmailService. Two entry points:
//
//   Queue(...)   → enqueue only; EmailWorker performs the actual SMTP call
//                  (what request handlers use — never block a response on
//                  a mail server round-trip).
//   SendAsync()  → connect/auth/send/disconnect once per message; called by
//                  the worker (retry loop lives there). Simple and safe for
//                  this app's volume — connection pooling buys nothing when
//                  emails are a handful per day.
//
// Enabled=false (the committed default) turns every send into a log line so
// fresh clones and the Testing environment never dial out.

using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Microsoft.Extensions.Options;
using server.Configuration;
using server.Infrastructure;
using server.Services.Interfaces;

namespace server.Services.Email
{
    public class EmailService : IEmailService
    {
        private readonly IEmailQueue _queue;
        private readonly EmailOptions _options;
        private readonly ILogger<EmailService> _logger;

        public EmailService(
            IEmailQueue queue,
            IOptions<EmailOptions> options,
            ILogger<EmailService> logger)
        {
            _queue = queue;
            _options = options.Value;
            _logger = logger;
        }

        public void Queue(string to, string subject, string htmlBody, string textBody)
            => Queue(new EmailJob(to, subject, htmlBody, textBody));

        public void Queue(EmailJob job)
        {
            if (string.IsNullOrWhiteSpace(job.To))
            {
                _logger.LogWarning("Dropping email with empty recipient: {Subject}", job.Subject);
                return;
            }

            if (!_options.Enabled)
            {
                _logger.LogInformation(
                    "Email disabled (Email:Enabled=false) — would have sent \"{Subject}\" to {To}",
                    job.Subject, job.To);
                return;
            }

            _queue.Enqueue(job);
        }

        public async Task SendAsync(EmailJob job, CancellationToken cancellationToken = default)
        {
            if (!_options.Enabled)
            {
                _logger.LogInformation(
                    "Email disabled (Email:Enabled=false) — skipping \"{Subject}\" to {To}",
                    job.Subject, job.To);
                return;
            }

            if (string.IsNullOrWhiteSpace(_options.SmtpHost))
                throw new InvalidOperationException("Email:SmtpHost is not configured.");

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_options.FromName, _options.FromAddress));
            message.To.Add(MailboxAddress.Parse(job.To));
            message.Subject = job.Subject;
            message.Body = new BodyBuilder
            {
                HtmlBody = job.HtmlBody,
                TextBody = job.TextBody,
            }.ToMessageBody();

            // 465 = implicit TLS; anything else (587/25) starts plaintext and
            // upgrades via STARTTLS when the server advertises it.
            var socketOptions = _options.UseSsl
                ? SecureSocketOptions.SslOnConnect
                : SecureSocketOptions.StartTlsWhenAvailable;

            using var client = new SmtpClient();
            await client.ConnectAsync(_options.SmtpHost, _options.SmtpPort, socketOptions, cancellationToken);

            if (!string.IsNullOrEmpty(_options.Username))
                await client.AuthenticateAsync(_options.Username, _options.Password, cancellationToken);

            await client.SendAsync(message, cancellationToken);
            await client.DisconnectAsync(true, cancellationToken);

            _logger.LogInformation("Sent email \"{Subject}\" to {To}", job.Subject, job.To);
        }
    }
}
