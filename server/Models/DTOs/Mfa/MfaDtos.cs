using System.ComponentModel.DataAnnotations;

namespace server.Models.DTOs.Mfa
{
    public class MfaChallengeResponseDto
    {
        public bool MfaRequired { get; set; }
        public string? PendingToken { get; set; }
    }

    public class MfaStatusResponseDto
    {
        public bool TotpEnabled { get; set; }
        public int RecoveryCodesRemaining { get; set; }
    }

    public class MfaEnrollResponseDto
    {
        public string Secret { get; set; } = null!;
        public string OtpauthUri { get; set; } = null!;
    }

    public class MfaCodeRequestDto
    {
        [Required]
        [RegularExpression(@"^[\d\s]{6,8}$", ErrorMessage = "Enter the 6-digit code from your authenticator app.")]
        public string Code { get; set; } = null!;
    }

    public class MfaConfirmEnrollResponseDto
    {
        public IReadOnlyList<string> RecoveryCodes { get; set; } = Array.Empty<string>();
        public string AccessToken { get; set; } = null!;
        public string RefreshToken { get; set; } = null!;
        public DateTimeOffset ExpiresAt { get; set; }
        public User.UserResponseDto User { get; set; } = null!;
    }

    public class MfaVerifyRequestDto
    {
        [Required]
        public string PendingToken { get; set; } = null!;

        [Required]
        [MaxLength(64)]
        public string Code { get; set; } = null!;
    }

    public class MfaVerifyResponseDto
    {
        public string AccessToken { get; set; } = null!;
        public string RefreshToken { get; set; } = null!;
        public DateTimeOffset ExpiresAt { get; set; }
        public User.UserResponseDto User { get; set; } = null!;
    }

    public class MfaRegenerateResponseDto
    {
        public IReadOnlyList<string> RecoveryCodes { get; set; } = Array.Empty<string>();
    }

    public class RefreshRequestDto
    {
        [Required]
        public string RefreshToken { get; set; } = null!;
    }

    public class RefreshResponseDto
    {
        public string AccessToken { get; set; } = null!;
        public string RefreshToken { get; set; } = null!;
        public DateTimeOffset ExpiresAt { get; set; }
    }
}
