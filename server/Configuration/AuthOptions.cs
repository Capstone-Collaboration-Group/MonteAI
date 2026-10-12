namespace server.Configuration
{
    public class AuthOptions
    {
        public const string SectionName = "Auth";

        // 256-bit symmetric key (base64) for HS256 signing of pending/access/refresh JWTs.
        // Dev: user-secrets or generated ephemeral key. Prod: env var / Key Vault.
        public string JwtSigningKey { get; set; } = string.Empty;
        public string Issuer { get; set; } = "MonteAI";
        public string Audience { get; set; } = "MonteAI.API";
        public int AccessTokenMinutes { get; set; } = 60;
        public int RefreshTokenDays { get; set; } = 30;
        public int PendingTokenMinutes { get; set; } = 5;
    }
}
