using System.Security.Claims;
using server.Services.Interfaces;

namespace server.Middleware;

public class RoleAuthorizationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RoleAuthorizationMiddleware> _logger;

    public RoleAuthorizationMiddleware(RequestDelegate next, ILogger<RoleAuthorizationMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    // Scoped services injected directly into InvokeAsync (not the constructor) �
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
            var uid = context.User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (!string.IsNullOrEmpty(uid))
            {
                string? role = null;

                if      ((await studentService.GetByIdAsync(uid))?.IsActive == true)     role = "Student";
                else if ((await facultyService.GetByIdAsync(uid))?.IsActive == true)     role = "Faculty";
                else if ((await programHeadService.GetByIdAsync(uid))?.IsActive == true) role = "ProgramHead";
                else if ((await adminService.GetByIdAsync(uid))?.IsActive == true)       role = "Admin";

                if (role != null)
                {
                    ((ClaimsIdentity)context.User.Identity).AddClaim(new Claim(ClaimTypes.Role, role));
                }
                else
                {
                    _logger.LogWarning("Authenticated UID {Uid} has no matching DB profile in any role table", uid);
                }
            }
        }

        await _next(context);
    }
}

public static class RoleAuthorizationMiddlewareExtensions
{
    public static IApplicationBuilder UseRoleAuthorization(this IApplicationBuilder app)
    {
        return app.UseMiddleware<RoleAuthorizationMiddleware>();
    }
}