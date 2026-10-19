// server/Configuration/EmailOptions.cs
//
// SMTP settings for the reusable email service, bound from the "Email"
// section of appsettings*.json. Credentials live only in the gitignored
// appsettings.Development.json / production secrets — never here.
//
// Enabled defaults to false so a fresh clone (or the Testing environment)
// boots and logs instead of dialing a half-configured SMTP server.

namespace server.Configuration
{
    public class EmailOptions
    {
        public const string SectionName = "Email";

        /// <summary>Master switch. false = every send is logged and dropped.</summary>
        public bool Enabled { get; set; }

        public string SmtpHost { get; set; } = string.Empty;

        public int SmtpPort { get; set; } = 587;

        /// <summary>true → SslOnConnect (implicit TLS, usually port 465).</summary>
        public bool UseSsl { get; set; }

        public string Username { get; set; } = string.Empty;

        public string Password { get; set; } = string.Empty;

        public string FromAddress { get; set; } = string.Empty;

        public string FromName { get; set; } = "MonteAI";

        /// <summary>Attempts per queued email (first try + retries). Default: 3.</summary>
        public int MaxAttempts { get; set; } = 3;
    }
}
