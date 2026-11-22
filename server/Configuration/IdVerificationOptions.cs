namespace server.Configuration;

public sealed class IdVerificationOptions
{
    public const string SectionName = "IdVerification";

    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = "monteai-registration";
    public int ClockSkewSeconds { get; set; } = 30;
    public int MaximumReceiptLifetimeSeconds { get; set; } = 600;
    public List<string> AllowedTemplateIds { get; set; } = ["cdm-front-v1"];
    public List<IdVerificationPublicKeyOptions> PublicKeys { get; set; } = [];
}

public sealed class IdVerificationPublicKeyOptions
{
    public string KeyId { get; set; } = string.Empty;
    public string PublicKeyPemBase64 { get; set; } = string.Empty;
}
