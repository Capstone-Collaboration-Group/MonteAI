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
        });
    }

    public void EnsureSchema()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Database.EnsureCreated();
    }

    // Seeds an active Student row so role resolution + profile load succeed.
    public void SeedStudent(string uid, string email, bool totpEnabled = false)
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
            StudentNumber = "12345678",
            Position = "Member",
            Institute = "CCS",
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

    public HttpClient CreateJsonClient() => CreateClient();

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
            _connection.Dispose();
    }
}
