using server.Models.DTOs.User;

namespace server.Services.Interfaces;

public sealed record StudentRegistrationResult(UserResponseDto User, bool Created);

public interface IStudentRegistrationService
{
    Task<StudentRegistrationResult> RegisterAsync(
        RegisterUserDto dto,
        VerifiedIdVerificationReceipt receipt,
        CancellationToken cancellationToken = default);
}
