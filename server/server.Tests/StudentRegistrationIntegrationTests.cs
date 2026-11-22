using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using server.Data;

namespace server.Tests;

[Collection(WebFactoryCollection.Name)]
public sealed class StudentRegistrationIntegrationTests
{
    private const string Uid = "registration-student-1";
    private const string Email = "student.personal@example.com";
    private const string FirebaseToken = "registration-firebase-token-1";
    private const string StudentNumber = "00-00123";
    private const string NameKey = "MARIAJOSE|Q|DELA CRUZ|JR";

    [Fact]
    public async Task ValidReceipt_AllowsPersonalEmail_AndIsIdempotent()
    {
        using var factory = CreateFactory();
        var receipt = factory.IssueIdVerificationReceipt(
            Uid,
            Email,
            StudentNumber,
            NameKey);
        var payload = RegistrationPayload(receipt);
        using var client = CreateClient(factory);

        var first = await client.PostAsJsonAsync("/api/v1/auth/register", payload);
        var retry = await client.PostAsJsonAsync("/api/v1/auth/register", payload);

        Assert.True(
            first.StatusCode == HttpStatusCode.Created,
            $"Expected Created, received {first.StatusCode}: {await first.Content.ReadAsStringAsync()}");
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await db.Students.CountAsync(student => student.Id == Uid));
        Assert.Single(await db.ConsumedIdVerificationReceipts.ToListAsync());
    }

    [Fact]
    public async Task MissingOrMismatchedReceipt_IsRejectedWithoutDatabaseWrites()
    {
        using var factory = CreateFactory();
        using var client = CreateClient(factory);
        var mismatched = factory.IssueIdVerificationReceipt(
            Uid,
            Email,
            "00-00999",
            NameKey);

        var missingResponse = await client.PostAsJsonAsync(
            "/api/v1/auth/register",
            RegistrationPayload(null));
        var mismatchResponse = await client.PostAsJsonAsync(
            "/api/v1/auth/register",
            RegistrationPayload(mismatched));

        Assert.Equal(HttpStatusCode.BadRequest, missingResponse.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, mismatchResponse.StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(await db.Students.ToListAsync());
        Assert.Empty(await db.ConsumedIdVerificationReceipts.ToListAsync());
    }

    [Fact]
    public async Task ReceiptReuseForDifferentPayload_IsRejected()
    {
        using var factory = CreateFactory();
        using var client = CreateClient(factory);
        var receipt = factory.IssueIdVerificationReceipt(
            Uid,
            Email,
            StudentNumber,
            NameKey,
            jti: "2b55b63a-0fee-49dd-b7ac-90d7a15b04be");
        var original = RegistrationPayload(receipt);
        var changed = RegistrationPayload(receipt);
        changed["Institute"] = "A different institute";

        var first = await client.PostAsJsonAsync("/api/v1/auth/register", original);
        var reuse = await client.PostAsJsonAsync("/api/v1/auth/register", changed);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, reuse.StatusCode);
    }

    [Fact]
    public async Task FailedStudentInsert_DoesNotConsumeReceipt()
    {
        using var factory = CreateFactory();
        factory.SeedStudent("existing-student", "existing@example.com", StudentNumber);
        using var client = CreateClient(factory);
        var receipt = factory.IssueIdVerificationReceipt(
            Uid,
            Email,
            StudentNumber,
            NameKey);

        var response = await client.PostAsJsonAsync(
            "/api/v1/auth/register",
            RegistrationPayload(receipt));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(await db.ConsumedIdVerificationReceipts.ToListAsync());
    }

    [Fact]
    public async Task UnverifiedEmailAndClientSuppliedUid_AreRejected()
    {
        using var unverifiedFactory = new MfaWebFactory();
        unverifiedFactory.EnsureSchema();
        unverifiedFactory.Firebase.Register(
            FirebaseToken,
            new FakeFirebaseUser(Uid, Email, EmailVerified: false));
        using var unverifiedClient = unverifiedFactory.CreateJsonClient();
        unverifiedClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", FirebaseToken);
        var receipt = unverifiedFactory.IssueIdVerificationReceipt(
            Uid,
            Email,
            StudentNumber,
            NameKey);

        var unverified = await unverifiedClient.PostAsJsonAsync(
            "/api/v1/auth/register",
            RegistrationPayload(receipt));

        Assert.Equal(HttpStatusCode.Forbidden, unverified.StatusCode);

        using var factory = CreateFactory();
        using var client = CreateClient(factory);
        var wrongUidPayload = RegistrationPayload(
            factory.IssueIdVerificationReceipt(Uid, Email, StudentNumber, NameKey));
        wrongUidPayload["Id"] = "attacker-selected-uid";
        var wrongUid = await client.PostAsJsonAsync("/api/v1/auth/register", wrongUidPayload);
        Assert.Equal(HttpStatusCode.BadRequest, wrongUid.StatusCode);
    }

    [Theory]
    [InlineData("expired")]
    [InlineData("wrong-name")]
    [InlineData("wrong-email")]
    [InlineData("wrong-uid")]
    [InlineData("unsupported-template")]
    public async Task InvalidReceiptClaims_AreRejectedWithoutDatabaseWrites(string variant)
    {
        using var factory = CreateFactory();
        using var client = CreateClient(factory);
        var receipt = factory.IssueIdVerificationReceipt(
            variant == "wrong-uid" ? "different-uid" : Uid,
            variant == "wrong-email" ? "different@example.com" : Email,
            StudentNumber,
            variant == "wrong-name" ? "MARTA|Q|DELA CRUZ|JR" : NameKey,
            templateId: variant == "unsupported-template" ? "unknown-front" : "cdm-front-v1",
            issuedAt: variant == "expired" ? DateTime.UtcNow.AddMinutes(-11) : null);

        var response = await client.PostAsJsonAsync("/api/v1/auth/register", RegistrationPayload(receipt));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.False(body.Contains(receipt, StringComparison.Ordinal), "Receipt rejections must not echo the token.");
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(await db.Students.ToListAsync());
        Assert.Empty(await db.ConsumedIdVerificationReceipts.ToListAsync());
    }

    [Fact]
    public async Task FacultyStillRequiresInstitutionalEmail_ButNoIdReceipt()
    {
        using var factory = CreateFactory();
        using var client = CreateClient(factory);
        var payload = RegistrationPayload(null);
        payload["Role"] = "Faculty";

        var personalEmail = await client.PostAsJsonAsync("/api/v1/auth/register", payload);
        Assert.Equal(HttpStatusCode.BadRequest, personalEmail.StatusCode);

        const string facultyEmail = "teacher@pnm.edu.ph";
        factory.Firebase.Register(FirebaseToken, new FakeFirebaseUser(Uid, facultyEmail));
        payload["Email"] = facultyEmail;
        var institutionalEmail = await client.PostAsJsonAsync("/api/v1/auth/register", payload);
        Assert.Equal(HttpStatusCode.Created, institutionalEmail.StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Single(await db.Faculties.ToListAsync());
        Assert.Empty(await db.ConsumedIdVerificationReceipts.ToListAsync());
    }

    private static MfaWebFactory CreateFactory()
    {
        var factory = new MfaWebFactory();
        factory.EnsureSchema();
        factory.Firebase.Register(FirebaseToken, new FakeFirebaseUser(Uid, Email));
        return factory;
    }

    private static HttpClient CreateClient(MfaWebFactory factory)
    {
        var client = factory.CreateJsonClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", FirebaseToken);
        return client;
    }

    private static Dictionary<string, object?> RegistrationPayload(string? receipt) => new()
    {
        ["Id"] = Uid,
        ["Email"] = Email,
        ["FirstName"] = "María-José",
        ["MiddleInitial"] = "Q",
        ["LastName"] = "Dela Cruz",
        ["Suffix"] = "Jr.",
        ["Role"] = "Student",
        ["StudentNumber"] = StudentNumber,
        ["Position"] = "Member",
        ["Institute"] = "Institute of Computing Studies",
        ["Program"] = "BS Computer Science",
        ["YearLevel"] = 4,
        ["Section"] = "A",
        ["PrivacyNoticeAccepted"] = true,
        ["PrivacyNoticeVersion"] = "2026-10-23",
        ["TermsAccepted"] = true,
        ["TermsVersion"] = "2026-10-23",
        ["IdVerificationReceipt"] = receipt,
    };

}
