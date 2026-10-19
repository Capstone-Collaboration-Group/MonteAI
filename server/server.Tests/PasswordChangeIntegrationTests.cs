using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using server.Models.DTOs.User;
using Xunit;

namespace server.Tests;

// End-to-end coverage of POST /api/v1/auth/change-password through the real
// pipeline: Firebase verification + Admin SDK write are faked (they need real
// Google APIs), everything else — auth middleware, role middleware, rate
// limiter, controller, security-email queueing — is the production code.
[Collection(WebFactoryCollection.Name)]
public class PasswordChangeIntegrationTests
{
    private const string Uid = "pw-student-1";
    private const string Email = "pw.student@student.pnm.edu.ph";
    private const string Token = "fake-firebase-token-pw-1";

    private static HttpClient CreateAuthedClient(MfaWebFactory factory)
    {
        factory.SeedStudent(Uid, Email, studentNumber: "91000001");
        factory.Firebase.Register(Token, new FakeFirebaseUser(Uid, Email));
        var client = factory.CreateJsonClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", Token);
        return client;
    }

    [Fact]
    public async Task ChangePassword_CorrectCurrentPassword_WritesFirebaseAndQueuesSecurityEmail()
    {
        using var factory = new MfaWebFactory();
        factory.EnsureSchema();
        var client = CreateAuthedClient(factory);

        var res = await client.PostAsJsonAsync("/api/v1/auth/change-password", new ChangePasswordRequestDto
        {
            CurrentPassword = factory.PasswordService.CorrectPassword,
            NewPassword = "brand-new-secret-1",
        });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Contains(factory.PasswordService.Updates, u => u.Uid == Uid && u.Password == "brand-new-secret-1");

        var (to, subject) = Assert.Single(factory.Email.Queued);
        Assert.Equal(Email, to);
        Assert.Contains("password was changed", subject, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ChangePassword_WrongCurrentPassword_Returns401AndSendsNothing()
    {
        using var factory = new MfaWebFactory();
        factory.EnsureSchema();
        var client = CreateAuthedClient(factory);

        var res = await client.PostAsJsonAsync("/api/v1/auth/change-password", new ChangePasswordRequestDto
        {
            CurrentPassword = "definitely-wrong",
            NewPassword = "brand-new-secret-1",
        });

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        Assert.Empty(factory.PasswordService.Updates);
        Assert.Empty(factory.Email.Queued);
    }

    [Fact]
    public async Task ChangePassword_WeakNewPassword_Returns400()
    {
        using var factory = new MfaWebFactory();
        factory.EnsureSchema();
        var client = CreateAuthedClient(factory);

        var res = await client.PostAsJsonAsync("/api/v1/auth/change-password", new ChangePasswordRequestDto
        {
            CurrentPassword = factory.PasswordService.CorrectPassword,
            NewPassword = "123",
        });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Empty(factory.PasswordService.Updates);
        Assert.Empty(factory.Email.Queued);
    }
}
