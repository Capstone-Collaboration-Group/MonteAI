using OtpNet;
using server.Services.Auth;
using Xunit;

namespace server.Tests;

public class TotpServiceTests
{
    private static TotpService CreateService()
        => new TotpService(new FakeDataProtectionProvider());

    [Fact]
    public void GenerateBase32Secret_Returns160BitBase32()
    {
        var svc = CreateService();

        var secret = svc.GenerateBase32Secret();

        Assert.False(string.IsNullOrWhiteSpace(secret));
        // 20 bytes = 32 base32 chars.
        Assert.Equal(32, secret.Length);
    }

    [Fact]
    public void EncryptDecrypt_RoundTrips()
    {
        var svc = CreateService();
        var secret = svc.GenerateBase32Secret();

        var enc = svc.EncryptSecret(secret);
        var dec = svc.DecryptSecret(enc);

        Assert.NotEqual(secret, enc);
        Assert.Equal(secret, dec);
    }

    [Fact]
    public void VerifyTotp_AcceptsValidCurrentCode()
    {
        var svc = CreateService();
        var bytes = KeyGeneration.GenerateRandomKey(20);
        var enc = svc.EncryptSecret(Base32Encoding.ToString(bytes));
        var code = new Totp(bytes).ComputeTotp();

        var result = svc.VerifyTotpCode(enc, code, 0);

        Assert.True(result.Success);
        Assert.True(result.UsedStep > 0);
    }

    [Fact]
    public void VerifyTotp_RejectsWrongCode()
    {
        var svc = CreateService();
        var bytes = KeyGeneration.GenerateRandomKey(20);
        var enc = svc.EncryptSecret(Base32Encoding.ToString(bytes));
        var code = new Totp(bytes).ComputeTotp();
        // 111111 is all-same-digit; astronomically unlikely to collide.
        var wrong = code == "111111" ? "111112" : "111111";

        var result = svc.VerifyTotpCode(enc, wrong, 0);

        Assert.False(result.Success);
    }

    [Fact]
    public void VerifyTotp_RejectsReplayOfSameStep()
    {
        var svc = CreateService();
        var bytes = KeyGeneration.GenerateRandomKey(20);
        var enc = svc.EncryptSecret(Base32Encoding.ToString(bytes));
        var totp = new Totp(bytes);
        var code = totp.ComputeTotp();
        var step = (long)(DateTime.UtcNow.Ticks / TimeSpan.TicksPerSecond) / totp.Step;

        var first = svc.VerifyTotpCode(enc, code, 0);
        Assert.True(first.Success);

        var second = svc.VerifyTotpCode(enc, code, first.UsedStep);
        Assert.False(second.Success);
    }

    [Fact]
    public void VerifyTotp_RejectsNonDigitOrWrongLength()
    {
        var svc = CreateService();
        var bytes = KeyGeneration.GenerateRandomKey(20);
        var enc = svc.EncryptSecret(Base32Encoding.ToString(bytes));

        Assert.False(svc.VerifyTotpCode(enc, "", 0).Success);
        Assert.False(svc.VerifyTotpCode(enc, "12345", 0).Success);
        Assert.False(svc.VerifyTotpCode(enc, "1234567", 0).Success);
        Assert.False(svc.VerifyTotpCode(enc, "abcdef", 0).Success);
    }

    [Fact]
    public void GenerateRecoveryCodes_Produces8UniqueCodes_HashRoundTrips()
    {
        var svc = CreateService();

        var set = svc.GenerateRecoveryCodes();

        Assert.Equal(8, set.PlainCodes.Count);
        Assert.Equal(8, set.Hashes.Count);
        Assert.Equal(8, set.PlainCodes.Distinct().Count());

        // Each plain code hashes to the matching stored hash and verifies.
        for (var i = 0; i < set.PlainCodes.Count; i++)
        {
            var verify = svc.VerifyRecoveryCode(set.PlainCodes[i], set.Hashes);
            Assert.True(verify.Success);
            Assert.Equal(7, verify.RemainingHashes.Count);
        }
    }

    [Fact]
    public void VerifyRecoveryCode_NormalizesCaseAndSeparators()
    {
        var svc = CreateService();
        var set = svc.GenerateRecoveryCodes();
        var plain = set.PlainCodes[0];
        // Lowercase, no hyphen: "ABCDE-FGHIJ" -> "abcdefghij".
        var mangled = plain.Replace("-", "").ToLowerInvariant();

        var result = svc.VerifyRecoveryCode(mangled, set.Hashes);

        Assert.True(result.Success);
    }

    [Fact]
    public void VerifyRecoveryCode_RejectsUnknownAndConsumesOnReuse()
    {
        var svc = CreateService();
        var set = svc.GenerateRecoveryCodes();

        Assert.False(svc.VerifyRecoveryCode("ZZZZZ-ZZZZZ", set.Hashes).Success);

        var plain = set.PlainCodes[0];
        var first = svc.VerifyRecoveryCode(plain, set.Hashes);
        Assert.True(first.Success);

        // The consumed hash is removed; reuse against remaining fails.
        var second = svc.VerifyRecoveryCode(plain, first.RemainingHashes);
        Assert.False(second.Success);
    }
}
