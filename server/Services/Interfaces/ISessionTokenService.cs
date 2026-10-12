namespace server.Services.Interfaces
{
    public interface ISessionTokenService
    {
        string IssuePendingToken(string uid);
        SessionTokenPair IssueSessionTokens(string uid, string role, string email);
        PendingTokenClaims? ValidatePendingToken(string token);
        SessionTokenClaims? ValidateAccessToken(string token);
        RefreshTokenClaims? ValidateRefreshToken(string token);
    }

    public sealed record PendingTokenClaims(string Uid);

    public sealed record SessionTokenClaims(string Uid, string Role, string? Email);

    public sealed record RefreshTokenClaims(string Uid, string Role);

    public sealed record SessionTokenPair(string AccessToken, string RefreshToken, DateTimeOffset ExpiresAt);
}
