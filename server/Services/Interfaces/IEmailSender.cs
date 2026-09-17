namespace server.Services.Interfaces
{
    public interface IEmailSender
    {
        Task SendOtpAsync(string recipient, string code, CancellationToken cancellationToken = default);
    }
}