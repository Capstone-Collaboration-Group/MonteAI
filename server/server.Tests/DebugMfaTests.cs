using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
using OtpNet;
using server.Models.DTOs.Mfa;
using server.Services.Auth;
using Xunit;

namespace server.Tests;

public class DebugMfaTests
{
    [Fact]
    public async Task Debug_EnrollChallengeVerify()
    {
        using var factory = new MfaWebFactory();
        factory.EnsureSchema();
        factory.SeedStudent("dbg-1", "dbg@pnm.edu.ph", totpEnabled: false);
        factory.Firebase.Register("tok", new FakeFirebaseUser("dbg-1", "dbg@pnm.edu.ph"));
        var client = factory.CreateJsonClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "tok");
        var totp = new TotpService(new FakeDataProtectionProvider());

        var enroll = await client.PostAsJsonAsync("/api/v1/auth/mfa/enroll", new { });
        Assert.True(HttpStatusCode.OK == enroll.StatusCode, $"enroll: {await enroll.Content.ReadAsStringAsync()}");
        var enrollBody = await enroll.Content.ReadFromJsonAsync<MfaEnrollResponseDto>();

        var code = new Totp(Base32Encoding.ToBytes(enrollBody!.Secret)).ComputeTotp();
        var confirm = await client.PostAsJsonAsync("/api/v1/auth/mfa/enroll/confirm", new MfaCodeRequestDto { Code = code });
        Assert.True(HttpStatusCode.OK == confirm.StatusCode, $"confirm: {await confirm.Content.ReadAsStringAsync()}");

        var challenge = await client.PostAsJsonAsync("/api/v1/auth/mfa/challenge", new { });
        Assert.True(HttpStatusCode.OK == challenge.StatusCode, $"challenge: {await challenge.Content.ReadAsStringAsync()}");
        var pending = (await challenge.Content.ReadFromJsonAsync<MfaChallengeResponseDto>())!.PendingToken;
        Assert.False(string.IsNullOrEmpty(pending), "pending token null");

        var jwt = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().ReadJwtToken(pending!);
        var claims = string.Join(", ", jwt.Claims.Select(c => $"{c.Type}={c.Value}"));
        var typ = jwt.Claims.FirstOrDefault(c => c.Type == "token_kind")?.Value ?? "<null>";

        var validator = factory.Services.GetRequiredService<server.Services.Interfaces.ISessionTokenService>();
        var validated = validator.ValidatePendingToken(pending!);

        if (validated == null)
        {
            var payloadB64 = pending!.Split('.')[1].Replace('-', '+').Replace('_', '/');
            switch (payloadB64.Length % 4) { case 2: payloadB64 += "=="; break; case 3: payloadB64 += "="; break; }
            var rawPayload = Encoding.UTF8.GetString(Convert.FromBase64String(payloadB64));
            Assert.Fail($"ValidatePendingToken returned null. typ={typ} rawPayload={rawPayload}");
        }

        Assert.True(validated != null, "unexpected null");

        client.DefaultRequestHeaders.Authorization = null;
        // Confirm already consumed this TOTP step (it stores TotpLastUsedStep), so
        // replay protection would reject the same code. Wait for the next step.
        await Task.Delay(TimeSpan.FromSeconds(31));
        var verifyCode = new Totp(Base32Encoding.ToBytes(enrollBody!.Secret)).ComputeTotp();
        var verify = await client.PostAsJsonAsync("/api/v1/auth/mfa/verify",
            new MfaVerifyRequestDto { PendingToken = pending!, Code = verifyCode });
        Assert.True(HttpStatusCode.OK == verify.StatusCode, $"verify: {await verify.Content.ReadAsStringAsync()}");
    }

    private static byte[] Base64UrlDecode(string input)
    {
        var s = input.Replace('-', '+').Replace('_', '/');
        switch (s.Length % 4)
        {
            case 2: s += "=="; break;
            case 3: s += "="; break;
        }
        return Convert.FromBase64String(s);
    }
}
