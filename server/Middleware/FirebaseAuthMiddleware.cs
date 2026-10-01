using System.Security.Claims;
using System.Text.Encodings.Web;
using FirebaseAdmin.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace server.Middleware;

public class FirebaseAuthOptions : AuthenticationSchemeOptions { }

public class FirebaseAuthMiddleware : AuthenticationHandler<FirebaseAuthOptions>
{
    public const string SchemeName = "Firebase";

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

        var idToken = headerValue["Bearer ".Length..].Trim();

        if(string.IsNullOrEmpty(idToken))
            return AuthenticateResult.Fail("Missing Token");

        try
        {
            var decodedToken = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(idToken, checkRevoked: true);

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, decodedToken.Uid),
                new("user_id", decodedToken.Uid),
            };

            if (decodedToken.Claims.TryGetValue("email", out var email) && email is not null)
            {
                claims.Add(new Claim(ClaimTypes.Email, email.ToString()!));
            }

            if(decodedToken.Claims.TryGetValue("email_verified", out var emailVerified)
                && bool.TryParse(emailVerified?.ToString(), out var isVerified) && isVerified)
            {
                claims.Add(new Claim("email_verified", "true"));
            }

            var identity = new ClaimsIdentity(claims, Scheme.Name);
            var principal = new ClaimsPrincipal(identity);
            var ticket = new AuthenticationTicket(principal, Scheme.Name);

            return AuthenticateResult.Success(ticket);
        }
        catch (FirebaseAuthException ex)
        {
            Logger.LogWarning(ex, "Firebase token verification failed");
            return AuthenticateResult.Fail("Invalid Firebase token.");
        }
    }
}