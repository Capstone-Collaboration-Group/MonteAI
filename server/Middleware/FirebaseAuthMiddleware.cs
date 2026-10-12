using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using server.Services.Interfaces;

namespace server.Middleware;

public class FirebaseAuthOptions : AuthenticationSchemeOptions { }

public class FirebaseAuthMiddleware : AuthenticationHandler<FirebaseAuthOptions>
{
    public const string SchemeName = "Firebase";
    public const string AuthMethodClaim = "auth_method";
    public const string AuthMethodSession = "session";
    public const string AuthMethodFirebase = "firebase";

    public FirebaseAuthMiddleware(
        IOptionsMonitor<FirebaseAuthOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder) { }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("Authorization", out var authHeader))
            return AuthenticateResult.NoResult();

        var headerValue = authHeader.ToString();
        if (!headerValue.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return AuthenticateResult.NoResult();

        var token = headerValue["Bearer ".Length..].Trim();

        if (string.IsNullOrEmpty(token))
            return AuthenticateResult.Fail("Missing Token");

        // Path 1: our backend-issued session JWT (MFA users post-verification).
        // Pending (mfa_pending) and refresh tokens fail ValidateAccessToken
        // (typ mismatch) and fall through to the Firebase path, which rejects
        // them — so they are never accepted as session credentials.
        var sessionTokens = Context.RequestServices.GetRequiredService<ISessionTokenService>();
        var session = sessionTokens.ValidateAccessToken(token);
        if (session != null)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, session.Uid),
                new("user_id", session.Uid),
                new(AuthMethodClaim, AuthMethodSession),
            };
            if (!string.IsNullOrEmpty(session.Role))
                claims.Add(new Claim(ClaimTypes.Role, session.Role));
            if (!string.IsNullOrEmpty(session.Email))
                claims.Add(new Claim(ClaimTypes.Email, session.Email));

            var identity = new ClaimsIdentity(claims, Scheme.Name);
            return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name));
        }

        // Path 2: raw Firebase ID token (users without TOTP — unchanged behavior).
        var verifier = Context.RequestServices.GetRequiredService<IFirebaseTokenVerifier>();
        var firebase = await verifier.VerifyAsync(token);
        if (firebase == null)
            return AuthenticateResult.Fail("Invalid Firebase token.");

        var firebaseClaims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, firebase.Uid),
            new("user_id", firebase.Uid),
            new(AuthMethodClaim, AuthMethodFirebase),
        };
        if (!string.IsNullOrEmpty(firebase.Email))
            firebaseClaims.Add(new Claim(ClaimTypes.Email, firebase.Email));
        if (firebase.EmailVerified)
            firebaseClaims.Add(new Claim("email_verified", "true"));

        var firebaseIdentity = new ClaimsIdentity(firebaseClaims, Scheme.Name);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(firebaseIdentity), Scheme.Name));
    }
}
