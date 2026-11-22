using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using server.Data;
using server.Models.DTOs.User;

namespace server.Tests;

public sealed class PythonReceiptContractFactAttribute : FactAttribute
{
    public PythonReceiptContractFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MONTEAI_IDV_CONTRACT_PYTHON")))
            Skip = "Set MONTEAI_IDV_CONTRACT_PYTHON to an interpreter with id-verification dependencies.";
    }
}

public sealed class LocalPythonReceiptContractFactAttribute : FactAttribute
{
    public LocalPythonReceiptContractFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MONTEAI_IDV_CONTRACT_PYTHON")) ||
            Environment.GetEnvironmentVariable("MONTEAI_IDV_CONTRACT_LOCAL_SETTINGS") != "1")
            Skip = "Set MONTEAI_IDV_CONTRACT_PYTHON and MONTEAI_IDV_CONTRACT_LOCAL_SETTINGS=1 for local signer/API trust checks.";
    }
}

[Collection(WebFactoryCollection.Name)]
[Trait("Category", "IDVerificationContract")]
public sealed class PythonReceiptRegistrationIntegrationTests
{
    private const string Uid = "python-contract-student";
    private const string Email = "student.personal@example.com";
    private const string FirebaseToken = "synthetic-contract-firebase-token";

    [LocalPythonReceiptContractFact]
    public async Task ExistingLocalSignerReceipt_RegistersAgainstTheConfiguredDevelopmentPublicTrust()
    {
        // Read only public receipt trust from the API config; do not boot its development host/database.
        var configuration = new ConfigurationBuilder()
            .AddJsonFile(Path.Combine(FindRepositoryRoot(), "server", "appsettings.Development.json"))
            .Build();
        var trust = configuration.GetSection("IdVerification")
            .AsEnumerable(makePathsRelative: true)
            .Where(setting => !string.IsNullOrEmpty(setting.Key) && setting.Value is not null)
            .ToDictionary(setting => setting.Key, setting => setting.Value);
        Assert.NotEmpty(trust);
        var signed = await IssueWithPythonAsync(useLocalSettings: true);
        using var factory = new MfaWebFactory(trust);
        factory.EnsureSchema(); // SQLite :memory:, even when using the existing development signing key.
        factory.Firebase.Register(FirebaseToken, new FakeFirebaseUser(Uid, Email));
        using var client = CreateClient(factory);

        var created = await client.PostAsJsonAsync("/api/v1/auth/register", Payload(signed.Receipt));
        var retry = await client.PostAsJsonAsync("/api/v1/auth/register", Payload(signed.Receipt));

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        var body = await created.Content.ReadAsStringAsync();
        Assert.False(body.Contains(signed.Receipt, StringComparison.Ordinal), "Registration must not return the receipt.");
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Single(await db.Students.ToListAsync());
        Assert.Single(await db.ConsumedIdVerificationReceipts.ToListAsync());
    }

    [PythonReceiptContractFact]
    public async Task RealPythonSignerReceipt_RegistersAndRetriesWithoutPersistingOrReturningTheReceipt()
    {
        var signed = await IssueWithPythonAsync();
        using var factory = CreateFactory(signed);
        using var client = CreateClient(factory);
        var payload = Payload(signed.Receipt);

        var first = await client.PostAsJsonAsync("/api/v1/auth/register", payload);
        var retry = await client.PostAsJsonAsync("/api/v1/auth/register", payload);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        var body = await first.Content.ReadAsStringAsync();
        Assert.False(body.Contains(signed.Receipt, StringComparison.Ordinal), "Registration must not return the receipt.");
        using var profile = JsonDocument.Parse(body);
        Assert.Equal(Uid, profile.RootElement.GetProperty("id").GetString());
        Assert.Equal(Email, profile.RootElement.GetProperty("email").GetString());
        Assert.Equal("Student", profile.RootElement.GetProperty("role").GetString());
        Assert.False(profile.RootElement.TryGetProperty("idVerificationReceipt", out _));

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await db.Students.CountAsync());
        var consumption = Assert.Single(await db.ConsumedIdVerificationReceipts.ToListAsync());
        Assert.Equal(Uid, consumption.FirebaseUid);
        Assert.False(JsonSerializer.Serialize(consumption).Contains(signed.Receipt, StringComparison.Ordinal),
            "Only receipt consumption metadata may be persisted.");
    }

    [PythonReceiptContractFact]
    public async Task RealPythonSignerReceipt_TamperingAndIdentityChangesCannotWriteToTheDatabase()
    {
        var signed = await IssueWithPythonAsync();
        using var factory = CreateFactory(signed);
        using var client = CreateClient(factory);
        var nameChanged = Payload(signed.Receipt);
        nameChanged.FirstName = "Marta";
        var numberChanged = Payload(signed.Receipt);
        numberChanged.StudentNumber = "00-00999";
        var uidChanged = Payload(signed.Receipt);
        uidChanged.Id = "different-uid";
        var emailChanged = Payload(signed.Receipt);
        emailChanged.Email = "different@example.com";
        var segments = signed.Receipt.Split('.');
        segments[2] = (segments[2][0] == 'A' ? "B" : "A") + segments[2][1..];
        var tampered = Payload(string.Join('.', segments));

        foreach (var payload in new[] { nameChanged, numberChanged, uidChanged, emailChanged, tampered })
        {
            var response = await client.PostAsJsonAsync("/api/v1/auth/register", payload);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            var body = await response.Content.ReadAsStringAsync();
            Assert.False(body.Contains(signed.Receipt, StringComparison.Ordinal), "Rejections must not echo the receipt.");
        }
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(await db.Students.ToListAsync());
        Assert.Empty(await db.ConsumedIdVerificationReceipts.ToListAsync());
    }

    private static MfaWebFactory CreateFactory(SignedContract signed)
    {
        var factory = new MfaWebFactory(new Dictionary<string, string?>
        {
            ["Issuer"] = signed.Issuer,
            ["Audience"] = signed.Audience,
            ["PublicKeys:0:KeyId"] = signed.KeyId,
            ["PublicKeys:0:PublicKeyPemBase64"] = signed.PublicKeyPemBase64,
        });
        factory.EnsureSchema(); // SQLite :memory:, never the development/Azure SQL connection.
        factory.Firebase.Register(FirebaseToken, new FakeFirebaseUser(Uid, Email));
        return factory;
    }

    private static HttpClient CreateClient(MfaWebFactory factory)
    {
        var client = factory.CreateJsonClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", FirebaseToken);
        return client;
    }

    private static RegisterUserDto Payload(string receipt) => new()
    {
        Id = Uid, Email = Email, Role = "Student", StudentNumber = "00-00123",
        FirstName = "María-José", MiddleInitial = 'Q', LastName = "Dela Cruz", Suffix = "Jr.",
        Position = "Member", Institute = "Institute of Computing Studies", Program = "BS Computer Science",
        YearLevel = 4, Section = "A", PrivacyNoticeAccepted = true, PrivacyNoticeVersion = "2026-10-23",
        TermsAccepted = true, TermsVersion = "2026-10-23", IdVerificationReceipt = receipt,
    };

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "id-verification", "verification", "receipts.py")))
            directory = directory.Parent;
        if (directory is null) throw new InvalidOperationException("Cannot find id-verification contract sources.");
        return directory.FullName;
    }

    private static async Task<SignedContract> IssueWithPythonAsync(bool useLocalSettings = false)
    {
        var start = new ProcessStartInfo(Environment.GetEnvironmentVariable("MONTEAI_IDV_CONTRACT_PYTHON")!)
        {
            WorkingDirectory = Path.Combine(FindRepositoryRoot(), "id-verification"),
            UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true,
            StandardInputEncoding = new UTF8Encoding(false), StandardOutputEncoding = Encoding.UTF8,
        };
        start.ArgumentList.Add("-B");
        start.ArgumentList.Add("-m");
        start.ArgumentList.Add("tools.registration_contract");
        using var process = Process.Start(start) ?? throw new InvalidOperationException("Cannot start the Python contract signer.");
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        var output = process.StandardOutput.ReadToEndAsync(timeout.Token);
        var diagnostics = process.StandardError.ReadToEndAsync(timeout.Token);
        await process.StandardInput.WriteAsync(JsonSerializer.Serialize(new
        {
            issuer = "https://id-verification.contract.test", audience = "monteai-registration", keyId = "python-contract-key",
            uid = Uid, email = Email,
            useLocalSettings,
            student = new { studentNumber = "00-00123", firstName = "María-José", middleInitial = "Q", lastName = "Dela Cruz", suffix = "Jr." },
        }));
        process.StandardInput.Close();
        try
        {
            await process.WaitForExitAsync(timeout.Token);
            // Never forward stdout/stderr (which may contain a sensitive receipt) to test logs.
            await diagnostics;
            if (process.ExitCode != 0) throw new InvalidOperationException("Python contract signer failed. Check the interpreter/dependencies.");
            return JsonSerializer.Deserialize<SignedContract>(await output, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
            }) ?? throw new InvalidOperationException("Python contract signer returned an invalid envelope.");
        }
        catch (JsonException)
        {
            throw new InvalidOperationException("Python contract signer returned an invalid envelope.");
        }
        catch (OperationCanceledException)
        {
            process.Kill(entireProcessTree: true);
            throw new InvalidOperationException("Python contract signer timed out.");
        }
    }

    private sealed class SignedContract
    {
        public string Receipt { get; init; } = null!;
        public string Issuer { get; init; } = null!;
        public string Audience { get; init; } = null!;
        public string KeyId { get; init; } = null!;
        public string PublicKeyPemBase64 { get; init; } = null!;
    }
}
