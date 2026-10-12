using Microsoft.AspNetCore.DataProtection;
using server.RateLimiting;
using server.Services.Auth;

namespace server.Tests;

// In-memory data protection so TotpService works without a persisted key ring.
public sealed class FakeDataProtectionProvider : IDataProtectionProvider
{
    public IDataProtector CreateProtector(string purpose) => new FakeDataProtector(purpose);
}

internal sealed class FakeDataProtector : IDataProtector
{
    private readonly string _purpose;
    public FakeDataProtector(string purpose) => _purpose = purpose;

    // Not chaining: TotpService creates one protector and uses it directly,
    // so a self-returning CreateProtector matches the real single-purpose use.
    public IDataProtector CreateProtector(string purpose) => this;

    // Reversible obfuscation is fine for tests — the point is only that the
    // stored value is not the plaintext secret and round-trips correctly.
    public byte[] Protect(byte[] plaintext)
        => System.Text.Encoding.UTF8.GetBytes($"{_purpose}|{Convert.ToBase64String(plaintext)}");

    public byte[] Unprotect(byte[] protectedData)
    {
        var raw = System.Text.Encoding.UTF8.GetString(protectedData);
        var idx = raw.IndexOf('|');
        if (idx < 0) throw new System.Security.Cryptography.CryptographicException("bad payload");
        var purpose = raw[..idx];
        if (purpose != _purpose)
            throw new System.Security.Cryptography.CryptographicException("purpose mismatch");
        return Convert.FromBase64String(raw[(idx + 1)..]);
    }
}

// Static limit values the integration test asserts against, mirroring
// MfaAttemptLimiter so the test stays in sync if the limiter changes.
public static class MfaAttemptLimiterTests
{
    public const int PermitLimit = MfaAttemptLimiter.PermitLimit;
}
