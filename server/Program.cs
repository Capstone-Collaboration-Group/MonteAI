using System.ClientModel;
using System.ClientModel.Primitives;
using System.Security.Claims;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Azure.AI.OpenAI;
using FirebaseAdmin;
using Google.Apis.Auth.OAuth2;
using Google.Cloud.Firestore;
using Google.Cloud.Firestore.V1;
using Google.Cloud.Storage.V1;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using OpenAI.Chat;
using OpenAI.Embeddings;
using Pinecone;
using Serilog;
using Serilog.Events;
using server.Configuration;
using server.Data;
using server.Middleware;
using server.Services;
using server.Services.AI;
using server.Services.Auth;
using server.Services.Interfaces;
using server.Services.Theses;


Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Information)
    .Enrich.FromLogContext()
    .WriteTo.Console(theme: Serilog.Sinks.SystemConsole.Themes.AnsiConsoleTheme.Code)
    .CreateBootstrapLogger();


try
{
    
    Log.Information("Starting MonteAI Server Application...");

    var builder = WebApplication.CreateBuilder(args);

    var chatEndpoint = builder.Configuration["AzureAI:Endpoint"];
    var chatApiKey = builder.Configuration["AzureAI:ApiKey"];
    var chatDeploymentName = builder.Configuration["AzureAI:DeploymentName"];

    var embedEndpoint = builder.Configuration["AzureAIEmbedding:Endpoint"];
    var embedDeploymentName = builder.Configuration["AzureAIEmbedding:EmbeddingDeploymentName"];
    var embedApiKey = builder.Configuration["AzureAIEmbedding:ApiKey"];

    var pineconeApiKey = builder.Configuration["Pinecone:ApiKey"];
    if (string.IsNullOrWhiteSpace(pineconeApiKey) && !builder.Environment.IsEnvironment("Testing"))
    {
        throw new InvalidOperationException("Pinecone API key is missing from configuration");
    }

    // Pinecone 
    builder.Services.AddSingleton(sp => new PineconeClient(pineconeApiKey));

    // Singletons (not transient): the clients are thread-safe and this reuses
    // one connection pool instead of building a new AzureOpenAIClient +
    // HttpClient per request (per-request churn was contributing to stalled
    // connections). NetworkTimeout/RetryPolicy fail fast on network stalls:
    // the System.ClientModel defaults (100s per attempt × 3 retries) let one
    // hung Azure OpenAI call block a chat request for ~7 minutes.
    //
    // Two chat clients with DIFFERENT timeouts (same deployment):
    //   "planner" — emits <= ~250 tokens of JSON, so it fails fast (20s) and
    //               the agent loop degrades to single-shot RAG on failure.
    //   "synth"   — the user-visible answer. STREAMING requests are guarded
    //               separately in MonteAiAgentService (first-update timeout +
    //               fresh-request retries), so this timeout mainly covers the
    //               non-streaming fallback: a full answer (<= 800 tokens) takes
    //               well under 30s when the request is healthy, and a hung one
    //               should be replaced quickly. Worst case: 2 x 30s = 60s.
    ChatClient CreateChatClient(TimeSpan networkTimeout)
    {
        var options = new AzureOpenAIClientOptions(AzureOpenAIClientOptions.ServiceVersion.V2024_06_01)
        {
            NetworkTimeout = networkTimeout,
            RetryPolicy = new ClientRetryPolicy(maxRetries: 1),
        };
        var azureClient = new AzureOpenAIClient(
            new Uri(chatEndpoint!),
            new ApiKeyCredential(chatApiKey!),
            options
        );

        return azureClient.GetChatClient(chatDeploymentName);
    }

    builder.Services.AddKeyedSingleton<ChatClient>(
        "planner", (_, _) => CreateChatClient(TimeSpan.FromSeconds(20)));
    builder.Services.AddKeyedSingleton<ChatClient>(
        "synth", (_, _) => CreateChatClient(TimeSpan.FromSeconds(30)));

    // 3. Register Embedding Client (Uses AzureAIEmbedding configuration)
    // Same singleton + fail-fast posture as the chat client above.
    builder.Services.AddSingleton<EmbeddingClient>(sp =>
    {
        var options = new AzureOpenAIClientOptions(AzureOpenAIClientOptions.ServiceVersion.V2024_06_01)
        {
            NetworkTimeout = TimeSpan.FromSeconds(20),
            RetryPolicy = new ClientRetryPolicy(maxRetries: 1),
        };
        var azureClient = new AzureOpenAIClient(
            new Uri(embedEndpoint!),
            new ApiKeyCredential(embedApiKey!),
            options
        );

        return azureClient.GetEmbeddingClient(embedDeploymentName);
    });
    // Use Serilog settings from configuration
    builder.Host.UseSerilog((context, services, configuration) => configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()
    );

 

    // firebase configuration
    // Skipped under the "Testing" environment so WebApplicationFactory
    // integration tests can boot without a service-account file.
    if (!builder.Environment.IsEnvironment("Testing"))
    {
        var firebaseJson = builder.Configuration["Firebase:AdminKeyPath"];
        var credential = !string.IsNullOrEmpty(firebaseJson) && firebaseJson.Trim().StartsWith("{")
            ? CredentialFactory.FromJson(firebaseJson, JsonCredentialParameters.ServiceAccountCredentialType)
            : CredentialFactory.FromFile(firebaseJson, JsonCredentialParameters.ServiceAccountCredentialType);

        var firebaseApp = FirebaseApp.DefaultInstance ?? FirebaseApp.Create(new AppOptions
        {
            Credential = credential
        });
        builder.Services.AddSingleton(firebaseApp);

        var firebaseProjectId = builder.Configuration["Firebase:ProjectId"];
        builder.Services.AddSingleton(_ => new FirestoreDbBuilder
        { ProjectId = firebaseProjectId, Credential = credential }.Build());

        builder.Services.AddSingleton(_ => StorageClient.Create(credential));
    }

    builder.Services
    .AddAuthentication(FirebaseAuthMiddleware.SchemeName)
    .AddScheme<FirebaseAuthOptions, FirebaseAuthMiddleware>(FirebaseAuthMiddleware.SchemeName, _ => { });

    builder.Services.AddAuthorization(options =>
    {
        options.FallbackPolicy = new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .RequireClaim(ClaimTypes.Role)
            .Build();

        options.AddPolicy("Reviewer", policy => 
            policy.RequireRole("Faculty", "Admin", "ProgramHead"));

        options.AddPolicy("Proceedings", policy =>
            policy.RequireRole("Student", "Faculty", "Admin", "ProgramHead"));

        options.AddPolicy("FirebaseAuthenticated", policy =>
            policy.RequireAuthenticatedUser());
    });
    builder.Services.AddHttpContextAccessor();

    // --- TOTP MFA ---
    builder.Services.Configure<server.Configuration.AuthOptions>(
        builder.Configuration.GetSection(server.Configuration.AuthOptions.SectionName));
    // Dev/test fallback: generate an ephemeral signing key so the server boots
    // without user-secrets setup. Tokens do not survive a restart (fine in dev).
    if (string.IsNullOrWhiteSpace(builder.Configuration[$"{server.Configuration.AuthOptions.SectionName}:JwtSigningKey"]))
    {
        if (builder.Environment.IsDevelopment() || builder.Environment.IsEnvironment("Testing"))
        {
            // Generate ONCE per app instance. A PostConfigure lambda would run on
            // every resolve, handing each request a different key — so tokens
            // issued by one request would fail validation in the next.
            var ephemeralKey = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
            builder.Services.PostConfigure<server.Configuration.AuthOptions>(o =>
            {
                if (string.IsNullOrWhiteSpace(o.JwtSigningKey))
                    o.JwtSigningKey = ephemeralKey;
            });
        }
        else
        {
            throw new InvalidOperationException("Auth:JwtSigningKey must be configured in production.");
        }
    }
    var dataProtection = builder.Services.AddDataProtection()
        .SetApplicationName("MonteAI");
    var dataProtectionKeysPath = builder.Configuration["DataProtection:KeysPath"];
    if (!string.IsNullOrWhiteSpace(dataProtectionKeysPath))
    {
        dataProtection.PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath));
    }
    // Singleton (not Scrutor-scoped) so failed-attempt windows persist across requests.
    builder.Services.AddSingleton<server.RateLimiting.IMfaAttemptLimiter, server.RateLimiting.MfaAttemptLimiter>();

    builder.Services.Configure<PineconeConfig>(
            builder.Configuration.GetSection(PineconeConfig.SectionName)
            );

    // Agent behaviour + cost caps (see MonteAiAgentConfig for every knob).
    builder.Services.Configure<MonteAiAgentConfig>(
        builder.Configuration.GetSection(MonteAiAgentConfig.SectionName));
    // Add services to the container.
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseSqlServer(
            builder.Configuration.GetConnectionString("DefaultConnection"),
            sqlServerOptions =>
            {
                sqlServerOptions.EnableRetryOnFailure(
                    maxRetryCount: 5,
                    maxRetryDelay: TimeSpan.FromSeconds(10),
                    errorNumbersToAdd: null);
            }));

    // Rate  Limiting
    builder.Services.AddRateLimiter(options =>
    {
        options.AddFixedWindowLimiter("HealthCheckLimit", opt =>
        {
            opt.PermitLimit = 5 ;
            opt.Window = TimeSpan.FromMinutes(1);
            opt.QueueLimit = 0;
        });

        // Chat generates paid LLM calls per message. Partitioned PER USER (by
        // Firebase uid) so one spamming tab cannot starve the whole class —
        // the old global 30/min limit meant a single runaway client 429'd
        // everyone. QueueLimit=0 = instant 429 (fail fast, no pile-up).
        options.AddPolicy("ChatLimit", context =>
            RateLimitPartition.GetFixedWindowLimiter(
                context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? context.Connection.RemoteIpAddress?.ToString()
                    ?? "unknown",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                }));

        options.AddPolicy("ProceedingsLimit", context =>
            RateLimitPartition.GetFixedWindowLimiter(
                context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? context.Connection.RemoteIpAddress?.ToString()
                    ?? "unknown",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                }));
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    });

    // AutoMapper Configuration
    builder.Services.AddAutoMapper(config =>
    {
        config.AddMaps(typeof(Program).Assembly);
    });

    builder.Services.Scan(scan => scan
        .FromAssemblyOf<Program>()
            .AddClasses(classes => classes
                .InNamespaces("server.Repositories")
                .NotInNamespaces("server.Repositories.Interfaces"))
            .AsMatchingInterface()
            .WithScopedLifetime()

       .FromAssemblyOf<Program>()
            .AddClasses(classes => classes
                .Where(t => t.Namespace?.StartsWith("server.Services") == true))
            .AsMatchingInterface()
            .WithScopedLifetime()
    );

    builder.Services.AddScoped<IFirebaseTokenVerifier, FirebaseAuthVerifier>();

    builder.Services.AddSingleton<IBlobService, BlobService>();

    // Capacity-stack singletons (server.Infrastructure — deliberately OUTSIDE
    // the Scrutor-scanned namespaces because they hold shared state and must
    // be singletons, not per-request scoped like the scanned services).
    // Registered AFTER the scan so these win for their interfaces.
    builder.Services.AddSingleton<server.Infrastructure.IAgentConcurrencyGate, server.Infrastructure.AgentConcurrencyGate>();
    builder.Services.AddSingleton<server.Infrastructure.ILlmCircuitBreaker, server.Infrastructure.LlmCircuitBreaker>();
    builder.Services.AddSingleton<server.Infrastructure.ISemanticAnswerCache, server.Infrastructure.SemanticAnswerCache>();

    // Note: IPineconeService, IAgentToolbox, and IMonteAiAgentService are
    // auto-registered by the Scrutor scan above (namespace server.Services.*
    // with matching interfaces).
    builder.Services.AddControllers()
        .AddJsonOptions(o =>
        {
            o.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
            o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        });
    // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(options =>
    {
        options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Name = "Authorization",
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            In = ParameterLocation.Header,
            Description = "Enter your Firebase token only — no need to type 'Bearer'"
        });
        options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
    });

    builder.Services.AddCors(options =>
    {
        options.AddPolicy("MonteSkolarPolicy", policy =>
        {
            policy.WithOrigins(
                "http://localhost:8080",
                "http://localhost:5173",
                "http://localhost:5174",
                "https://localhost:5174",
                "https://localhost:8080",
                "https://localhost:5173",
                "https://monteskolar.pnm.edu.ph",
                "http://192.168.100.9:8081"
                )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
        });
    });


    var app = builder.Build();


    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
        

        app.MapGet("/", context => {
            context.Response.Redirect("/swagger");
            return Task.CompletedTask;
        }).AllowAnonymous();
    }

    app.UseRouting();
    app.UseSerilogRequestLogging();

    // Dev only: skip the HTTP->HTTPS redirect so LAN devices (e.g. a physical
    // phone in the Expo dev build) can hit the plain-HTTP endpoint on :5084
    // without failing on the self-signed dev cert. Browsers/desktop already
    // target https://localhost:7085 directly, so they are unaffected.
    if (!app.Environment.IsDevelopment())
    {
        app.UseHttpsRedirection();
    }
    app.UseCors("MonteSkolarPolicy"); 
    app.UseAuthentication();
    app.UseRoleAuthorization();
    app.UseAuthorization();
    app.UseRateLimiter();

    app.MapControllers();
    
//    app.MapGet("/api/v1/Auth/me", (ClaimsPrincipal user) =>
//{
//    var uid = user.FindFirstValue("user_id") ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
//    var email = user.FindFirstValue("email");
//    return Results.Ok(new { uid, email });
//}).RequireAuthorization();

    app.MapGet("/health", ([FromHeader(Name = "X-Ping-Secret")] string? header, IConfiguration configuration) =>
    {
        var secret = configuration["PING_SECRET"];
        //var header = request.Headers["X-Ping-Secret"].FirstOrDefault();

        if (header != secret) return Results.Unauthorized();

        return Results.Ok(new { status = "Healthy", timestamp = DateTime.UtcNow });
    }).AllowAnonymous().RequireRateLimiting("HealthCheckLimit");


    app.Run();

}catch(Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Application Terminated Unexpectedly.");
}
finally
{
    Log.CloseAndFlush();
}

// Exposes Program to WebApplicationFactory-based integration tests.
public partial class Program { }