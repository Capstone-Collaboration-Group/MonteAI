using FirebaseAdmin.Auth;
using server.Services.Interfaces;

namespace server.Services.Auth
{
    public class FirebaseAuthVerifier : IFirebaseTokenVerifier
    {
        private readonly ILogger<FirebaseAuthVerifier> _logger;

        public FirebaseAuthVerifier(ILogger<FirebaseAuthVerifier> logger)
        {
            _logger = logger;
        }

        public async Task<FirebaseVerifiedToken?> VerifyAsync(string idToken)
        {
            try
            {
                var decoded = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(idToken, checkRevoked: true);
                string? email = null;
                var emailVerified = false;
                if (decoded.Claims.TryGetValue("email", out var emailValue) && emailValue is not null)
                    email = emailValue.ToString();
                if (decoded.Claims.TryGetValue("email_verified", out var verifiedValue)
                    && bool.TryParse(verifiedValue?.ToString(), out var isVerified))
                    emailVerified = isVerified;
                return new FirebaseVerifiedToken(decoded.Uid, email, emailVerified);
            }
            catch (FirebaseAuthException ex)
            {
                _logger.LogWarning(ex, "Firebase token verification failed");
                return null;
            }
        }
    }
}
