// server/Services/Auth/FirebasePasswordService.cs
//
// Password changes are owned by Firebase Auth (this API stores no
// credentials). Two halves:
//
//   VerifyCurrentPasswordAsync — Firebase Identity Toolkit REST
//       POST accounts:signInWithPassword?key={Firebase:WebApiKey}
//       (the Admin SDK cannot verify passwords, only write them).
//   UpdatePasswordAsync — FirebaseAdmin FirebaseAuth.DefaultInstance
//       .UpdateUserAsync(uid, { Password }).
//
// Config: Firebase:WebApiKey (the Web API key from the Firebase console —
// different from AdminKeyPath, which is the service-account file). Missing
// key => UpdatePasswordAsync/verify fail loudly via InvalidOperationException
// so misconfiguration is obvious instead of silently never emailing.

using System.Text;
using System.Text.Json;
using FirebaseAdmin.Auth;

namespace server.Services.Auth
{
    public class FirebasePasswordService : Interfaces.IFirebasePasswordService
    {
        private const string VerifyEndpoint =
            "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";

        // Shared: this is a low-frequency, high-URL-count endpoint — a static
        // client avoids socket exhaustion without pulling in IHttpClientFactory
        // ceremony for a single call site.
        private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(15) };

        private readonly IConfiguration _config;
        private readonly ILogger<FirebasePasswordService> _logger;

        public FirebasePasswordService(IConfiguration config, ILogger<FirebasePasswordService> logger)
        {
            _config = config;
            _logger = logger;
        }

        public async Task<bool> VerifyCurrentPasswordAsync(string email, string password, CancellationToken cancellationToken = default)
        {
            var apiKey = _config["Firebase:WebApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
                throw new InvalidOperationException("Firebase:WebApiKey is missing from configuration.");

            try
            {
                using var content = new StringContent(
                    JsonSerializer.Serialize(new { email, password, returnSecureToken = true }),
                    Encoding.UTF8,
                    "application/json");

                using var response = await Http.PostAsync(
                    $"{VerifyEndpoint}?key={apiKey}", content, cancellationToken);

                if (response.IsSuccessStatusCode) return true;

                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogWarning(
                    "Firebase password verification failed for {Email}: {Status} {Body}",
                    email, (int)response.StatusCode, Truncate(body));
                return false;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Firebase password verification errored for {Email}", email);
                return false;
            }
        }

        public async Task UpdatePasswordAsync(string uid, string newPassword, CancellationToken cancellationToken = default)
        {
            try
            {
                await FirebaseAuth.DefaultInstance.UpdateUserAsync(
                    new UserRecordArgs { Uid = uid, Password = newPassword },
                    cancellationToken);
            }
            catch (FirebaseAuthException ex)
            {
                _logger.LogError(ex, "Firebase password update failed for UID {Uid}", uid);
                throw;
            }
        }

        private static string Truncate(string value)
            => value.Length <= 300 ? value : value[..300] + "…";
    }
}
