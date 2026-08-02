using System.ClientModel;
using System.Security.Claims;
using Azure.AI.OpenAI;
using FirebaseAdmin;
using Google.Apis.Auth.OAuth2;
using Google.Cloud.Firestore;
using Google.Cloud.Firestore.V1;
using Google.Cloud.Storage.V1;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
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
using server.Services.Interfaces;


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

    var pineconeApiKey = builder.Configuration["Pinecone:ApiKey"] ??
        throw new InvalidOperationException("Pinecone API key is missing from configuration");

    // Pinecone 
    builder.Services.AddSingleton(sp => new PineconeClient(pineconeApiKey));

    builder.Services.AddTransient<ChatClient>(sp =>
    {
        var options = new AzureOpenAIClientOptions(AzureOpenAIClientOptions.ServiceVersion.V2024_06_01);
        var azureClient = new AzureOpenAIClient(
            new Uri(chatEndpoint!),
            new ApiKeyCredential(chatApiKey!), 
            options
        );

        return azureClient.GetChatClient(chatDeploymentName);
    });

    // 3. Register Embedding Client (Uses AzureAIEmbedding configuration)
    builder.Services.AddTransient<EmbeddingClient>(sp =>
    {
        var options = new AzureOpenAIClientOptions(AzureOpenAIClientOptions.ServiceVersion.V2024_06_01);
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

    builder.Services
    .AddAuthentication(FirebaseAuthMiddleware.SchemeName)
    .AddScheme<FirebaseAuthOptions, FirebaseAuthMiddleware>(FirebaseAuthMiddleware.SchemeName, _ => { });

    builder.Services.AddAuthorization(options =>
    {
        options.DefaultPolicy = new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .RequireClaim(ClaimTypes.Role)
            .Build();

        options.AddPolicy("FirebaseAuthenticated", policy =>
            policy.RequireAuthenticatedUser());
    });
     
    builder.Services.Configure<PineconeConfig>(
            builder.Configuration.GetSection(PineconeConfig.SectionName)
            );
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

    builder.Services.AddSingleton<IBlobService, BlobService>();

    builder.Services.AddScoped<IPineconeService, PineconeService>();



       

    
    builder.Services.AddControllers();
    // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen();

    builder.Services.AddCors(options =>
    {
        options.AddPolicy("MonteSkolarPolicy", policy =>
        {
            policy.WithOrigins(
                "http://localhost:8080",
                "http://localhost:5173",
                "https://localhost:8080",
                "https://localhost:5173",
                "https://monteskolar.pnm.edu.ph"
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
        });
    }

    app.UseRouting();
    app.UseSerilogRequestLogging();

    app.UseHttpsRedirection();
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
    }).RequireRateLimiting("HealthCheckLimit");


    app.Run();

}catch(Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Application Terminated Unexpectedly.");
}
finally
{
    Log.CloseAndFlush();
}
