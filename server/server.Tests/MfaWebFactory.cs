using System.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using server.Data;
using server.Infrastructure;
using server.Models.Entities;
using server.Services.Interfaces;

namespace server.Tests;

// A Firebase ID token is represented purely by its raw string; the fake
// verifier maps that string straight to a uid so tests can mint any identity.
public sealed record FakeFirebaseUser(string Uid, string? Email = null, bool EmailVerified = true);

public sealed class FakeFirebaseTokenVerifier : IFirebaseTokenVerifier
{
    private readonly Dictionary<string, FakeFirebaseUser> _tokens = new();

    public void Register(string token, FakeFirebaseUser user) => _tokens[token] = user;

    public Task<FirebaseVerifiedToken?> VerifyAsync(string idToken)
        => Task.FromResult(_tokens.TryGetValue(idToken, out var u)
            ? new FirebaseVerifiedToken(u.Uid, u.Email, u.EmailVerified)
            : null);
}

// Captures IEmailService.Queue calls so tests can assert a security email was
// emitted without touching SMTP (the real EmailService would just log-drop
// with Email:Enabled=false in the Testing environment).
public sealed class FakeEmailService : IEmailService
{
    private readonly List<(string To, string Subject)> _queued = new();
    public IReadOnlyList<(string To, string Subject)> Queued => _queued;

    public void Queue(string to, string subject, string htmlBody, string textBody)
        => _queued.Add((to, subject));

    public void Queue(EmailJob job) => _queued.Add((job.To, job.Subject));

    public Task SendAsync(EmailJob job, CancellationToken cancellationToken = default)
        => Task.CompletedTask;
}

// Password verification/write against Firebase — tests set CorrectPassword
// and assert UpdatePasswordAsync was invoked with the new value.
public sealed class FakeFirebasePasswordService : IFirebasePasswordService
{
    public string CorrectPassword { get; set; } = "correct-horse";
    public List<(string Uid, string Password)> Updates { get; } = new();

    public Task<bool> VerifyCurrentPasswordAsync(string email, string password, CancellationToken cancellationToken = default)
        => Task.FromResult(password == CorrectPassword);

    public Task UpdatePasswordAsync(string uid, string newPassword, CancellationToken cancellationToken = default)
    {
        Updates.Add((uid, newPassword));
        return Task.CompletedTask;
    }
}

// Boots the real Program pipeline (auth middleware, role middleware, controllers)
// against an in-memory SQLite database with a fake Firebase verifier, so the
// TOTP MFA flow can be exercised end to end without external services.
public sealed class MfaWebFactory : WebApplicationFactory<Program>
{
    // An in-memory SQLite database only lives as long as its connection, and
    // ConfigureWebHost can run more than once per host build. Re-opening on a
    // disposed connection throws, which surfaces as the host never building.
    private readonly SqliteConnection _connection = new("DataSource=:memory:");

    public FakeFirebaseTokenVerifier Firebase { get; } = new();
    public FakeEmailService Email { get; } = new();
    public FakeFirebasePasswordService PasswordService { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        if (_connection.State != ConnectionState.Open)
            _connection.Open();

        builder.UseEnvironment("Testing");

        // A fixed base64 256-bit key: tokens issued in one request must validate
        // in the next, and the factory spins up multiple scopes per test.
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Auth:JwtSigningKey"] = Convert.ToBase64String(Enumerable.Range(0, 32).Select(i => (byte)i).ToArray()),
            });
        });

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppDbContext>>();

            services.AddDbContext<AppDbContext>(o => o.UseSqlite(_connection));

            services.RemoveAll<IFirebaseTokenVerifier>();
            services.AddSingleton<IFirebaseTokenVerifier>(Firebase);

            services.RemoveAll<IEmailService>();
            services.AddSingleton<IEmailService>(Email);

            services.RemoveAll<IFirebasePasswordService>();
            services.AddSingleton<IFirebasePasswordService>(PasswordService);
        });
    }

    public void EnsureSchema()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Database.EnsureCreated();
    }

    // Seeds an active Student row so role resolution + profile load succeed.
    // StudentNumber is unique in the schema, so tests that seed multiple
    // students pass distinct numbers explicitly (uid alone is not enough).
    public void SeedStudent(string uid, string email, string studentNumber = "12345678", bool totpEnabled = false, string institute = "CCS")
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Students.Add(new Student
        {
            Id = uid,
            Email = email,
            FirstName = "Test",
            MiddleInitial = 'M',
            LastName = "Student",
            Role = "Student",
            StudentNumber = studentNumber,
            Position = "Member",
            Institute = institute,
            Program = "BSCS",
            YearLevel = 1,
            Section = 'A',
            IsActive = true,
            TotpEnabled = totpEnabled,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        db.SaveChanges();
    }

    // Role resolution walks Students -> Faculties -> ProgramHeads -> Admins;
    // Admin/ProgramHead rows let tests hit [Authorize(Roles=...)] endpoints.
    public void SeedAdmin(string uid, string email)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Admins.Add(new Admin
        {
            Id = uid,
            Email = email,
            FirstName = "Test",
            MiddleInitial = 'M',
            LastName = "Admin",
            Role = "Admin",
            Position = "System Admin",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        db.SaveChanges();
    }

    public void SeedProgramHead(string uid, string email, string institute)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.ProgramHeads.Add(new ProgramHead
        {
            Id = uid,
            Email = email,
            FirstName = "Test",
            MiddleInitial = 'M',
            LastName = "Head",
            Role = "ProgramHead",
            Institute = institute,
            ProgramHandled = "BSCS",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        db.SaveChanges();
    }

    public HttpClient CreateJsonClient() => CreateClient();

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
            _connection.Dispose();
    }
}
