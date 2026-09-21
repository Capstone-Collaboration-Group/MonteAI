using System.Net;
using System.Net.Mail;
using server.Services.Interfaces;

namespace server.Services.Auth
{
    public class EmailSender : IEmailSender
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<EmailSender> _logger;

        public EmailSender(IConfiguration configuration, ILogger<EmailSender> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public async Task SendOtpAsync(string recipient, string code, CancellationToken cancellationToken = default)
        {
            var host = _configuration["Email:SmtpHost"];
            var from = _configuration["Email:From"];
            if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(from))
            {
                _logger.LogWarning("Email SMTP is not configured; OTP delivery skipped for {Email}", recipient);
                return;
            }

            using var client = new SmtpClient(host, _configuration.GetValue<int>("Email:SmtpPort", 587))
            {
                EnableSsl = _configuration.GetValue("Email:EnableSsl", true),
                Credentials = new NetworkCredential(_configuration["Email:Username"], _configuration["Email:Password"])
            };
            using var message = new MailMessage(from, recipient)
            {
                Subject = "MonteAI email verification code",
                Body = $"Your MonteAI verification code is {code}. It expires in 5 minutes.",
                IsBodyHtml = false
            };
            await client.SendMailAsync(message, cancellationToken);
        }
    }
}