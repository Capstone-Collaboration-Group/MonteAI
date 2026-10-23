using System.Security.Claims;
using System.Text.Json;
using server.Services.Interfaces;

namespace server.Middleware;

public class RoleAuthorizationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RoleAuthorizationMiddleware> _logger;

    // Firebase-token requests are allowed only up to these endpoints even
    // when TotpEnabled (challenge issues the pending token; enroll/disable
    // manage MFA itself and run before/while the session token exists).
    private static readonly string[] FirebaseExemptPaths =
    {
        "/api/v1/auth/mfa/challenge",
        "/api/v1/auth/mfa/enroll",
        "/api/v1/auth/mfa/enroll/confirm",
        "/api/v1/auth/mfa/disable",
        "/api/v1/auth/mfa/recovery-codes/regenerate",
        "/api/v1/auth/mfa/status",
    };

    public RoleAuthorizationMiddleware(RequestDelegate next, ILogger<RoleAuthorizationMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    // Scoped services injected directly into InvokeAsync (not the constructor) —
    // required since this middleware instance is a singleton but IStudentService etc. are scoped.
    public async Task InvokeAsync(
        HttpContext context,
        IStudentService studentService,
        IFacultyService facultyService,
        IAdminService adminService,
        IProgramHeadService programHeadService
    )
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var authMethod = context.User.FindFirstValue(FirebaseAuthMiddleware.AuthMethodClaim);

            // Session JWT already carries the role claim issued at MFA verify —
            // skip the 4-table lookup entirely.
            if (authMethod == FirebaseAuthMiddleware.AuthMethodSession)
            {
                // Role claim was embedded at issuance; nothing to resolve.
            }
            else
            {
                var uid = context.User.FindFirstValue(ClaimTypes.NameIdentifier);

                if (!string.IsNullOrEmpty(uid))
                {
                    string? role = null;
                    bool totpEnabled = false;

                    var student = await studentService.GetByIdAsync(uid);
                    if (student?.IsActive == true) { role = "Student"; totpEnabled = student.TotpEnabled; }
                    else
                    {
                        var faculty = await facultyService.GetByIdAsync(uid);
                        if (faculty?.IsActive == true) { role = "Faculty"; totpEnabled = faculty.TotpEnabled; }
                        else
                        {
                            var programHead = await programHeadService.GetByIdAsync(uid);
                            if (programHead?.IsActive == true) { role = "ProgramHead"; totpEnabled = programHead.TotpEnabled; }
                            else
                            {
                                var admin = await adminService.GetByIdAsync(uid);
                                if (admin?.IsActive == true) { role = "Admin"; totpEnabled = admin.TotpEnabled; }
                            }
                        }
                    }

                    if (role != null)
                    {
                        var identity = (ClaimsIdentity)context.User.Identity;
                        identity.AddClaim(new Claim(ClaimTypes.Role, role));

                        // Requirement 8: a raw Firebase ID token must not grant
                        // access once TOTP is enabled — only the session JWT
                        // (issued post-MFA) does. Exempt MFA-management paths.
                        if (totpEnabled
                            && authMethod == FirebaseAuthMiddleware.AuthMethodFirebase
                            && !IsFirebaseExemptPath(context.Request.Path))
                        {
                            context.Response.StatusCode = StatusCodes.Status403Forbidden;
                            context.Response.ContentType = "application/json";
                            await context.Response.WriteAsync(JsonSerializer.Serialize(new
                            {
                                code = "mfa_required",
                                message = "Multi-factor authentication is enabled. Sign in with your second factor to obtain a session token.",
                            }));
                            return;
                        }
                    }
                    else
                    {
                        _logger.LogWarning("Authenticated UID {Uid} has no matching DB profile in any role table", uid);
                    }
                }
            }
        }

        await _next(context);
    }

    private static bool IsFirebaseExemptPath(PathString path)
        => FirebaseExemptPaths.Any(p => path.StartsWithSegments(p, StringComparison.OrdinalIgnoreCase));
}

public static class RoleAuthorizationMiddlewareExtensions
{
    public static IApplicationBuilder UseRoleAuthorization(this IApplicationBuilder app)
    {
        return app.UseMiddleware<RoleAuthorizationMiddleware>();
    }
}
