namespace server.Services.Interfaces
{
    public interface IEmailVerificationService
    {
        Task<bool> IssueOtpAsync(string email, CancellationToken cancellationToken = default);
        Task<(bool Success, string? Error)> VerifyOtpAsync(string email, string code, CancellationToken cancellationToken = default);
    }
}