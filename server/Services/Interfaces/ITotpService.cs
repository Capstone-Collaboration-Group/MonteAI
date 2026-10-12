namespace server.Services.Interfaces
{
    public interface ITotpService
    {
        string GenerateBase32Secret();
        string BuildOtpauthUri(string email, string base32Secret);
        string EncryptSecret(string base32Secret);
        string DecryptSecret(string encryptedSecret);
        TotpStepVerification VerifyTotpCode(string encryptedSecret, string code, long lastUsedStep);
        RecoveryCodeSet GenerateRecoveryCodes();
        RecoveryCodeVerification VerifyRecoveryCode(string code, IReadOnlyList<string> storedHashes);
        string HashRecoveryCode(string code);
    }

    public sealed class TotpStepVerification
    {
        public bool Success { get; init; }
        public long UsedStep { get; init; }
    }

    public sealed class RecoveryCodeSet
    {
        public IReadOnlyList<string> PlainCodes { get; init; } = Array.Empty<string>();
        public IReadOnlyList<string> Hashes { get; init; } = Array.Empty<string>();
    }

    public sealed class RecoveryCodeVerification
    {
        public bool Success { get; init; }
        public IReadOnlyList<string>? RemainingHashes { get; init; }
    }
}
