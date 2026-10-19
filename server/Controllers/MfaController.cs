using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using server.Models.DTOs.Mfa;
using server.Models.DTOs.User;
using server.RateLimiting;
using server.Services.Email;
using server.Services.Interfaces;
using server.Services.Theses;

namespace server.Controllers
{
    [ApiController]
    [Route("api/v1/auth/mfa")]
    [Authorize]
    public class MfaController : ControllerBase
    {
        private readonly ITotpService _totp;
        private readonly ISessionTokenService _sessionTokens;
        private readonly IMfaStore _mfaStore;
        private readonly IMfaAttemptLimiter _attemptLimiter;
        private readonly IStudentService _studentService;
        private readonly IFacultyService _facultyService;
        private readonly IProgramHeadService _programHeadService;
        private readonly IAdminService _adminService;
        private readonly IEmailService _email;
        private readonly ILogger<MfaController> _logger;

        public MfaController(
            ITotpService totp,
            ISessionTokenService sessionTokens,
            IMfaStore mfaStore,
            IMfaAttemptLimiter attemptLimiter,
            IStudentService studentService,
            IFacultyService facultyService,
            IProgramHeadService programHeadService,
            IAdminService adminService,
            IEmailService email,
            ILogger<MfaController> logger)
        {
            _totp = totp;
            _sessionTokens = sessionTokens;
            _mfaStore = mfaStore;
            _attemptLimiter = attemptLimiter;
            _studentService = studentService;
            _facultyService = facultyService;
            _programHeadService = programHeadService;
            _adminService = adminService;
            _email = email;
            _logger = logger;
        }

        private string? Uid => User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);

        // ── Challenge (login step 1) ────────────────────────────────────
        // Called with a raw Firebase token right after Firebase sign-in.
        // TOTP users get a pending token; everyone else gets mfaRequired=false
        // and continues with the Firebase token exactly as before.
        [HttpPost("challenge")]
        [AllowAnonymous]
        public async Task<IActionResult> CreateChallenge()
        {
            var uid = Uid;
            if (string.IsNullOrEmpty(uid))
                return Unauthorized(new { Message = "No user ID found in token." });

            var user = await _mfaStore.FindUserAsync(uid);
            if (user == null || user.IsActive != true)
                return NotFound(new { Message = "No user profile found for this account." });

            if (!user.TotpEnabled)
                return Ok(new MfaChallengeResponseDto { MfaRequired = false });

            var pendingToken = _sessionTokens.IssuePendingToken(uid);
            return Ok(new MfaChallengeResponseDto { MfaRequired = true, PendingToken = pendingToken });
        }

        // ── Status ──────────────────────────────────────────────────────
        [HttpGet("status")]
        public async Task<IActionResult> Status()
        {
            var uid = Uid;
            if (string.IsNullOrEmpty(uid))
                return Unauthorized(new { Message = "No user ID found in token." });

            var user = await _mfaStore.FindUserAsync(uid);
            if (user == null)
                return NotFound(new { Message = "No user profile found for this account." });

            return Ok(new MfaStatusResponseDto
            {
                TotpEnabled = user.TotpEnabled,
                RecoveryCodesRemaining = user.RecoveryCodeHashes?.Count ?? 0,
            });
        }

        // ── Enroll (step 1 of setup) ────────────────────────────────────
        [HttpPost("enroll")]
        public async Task<IActionResult> Enroll()
        {
            var uid = Uid;
            if (string.IsNullOrEmpty(uid))
                return Unauthorized(new { Message = "No user ID found in token." });

            var user = await _mfaStore.FindUserAsync(uid);
            if (user == null)
                return NotFound(new { Message = "No user profile found for this account." });

            if (user.TotpEnabled)
                return Conflict(new { Message = "TOTP is already enabled for this account." });

            if (!string.IsNullOrEmpty(user.TotpSecretEncrypted))
            {
                var pendingSecret = _totp.DecryptSecret(user.TotpSecretEncrypted);
                var pendingUri = _totp.BuildOtpauthUri(user.Email ?? string.Empty, pendingSecret);
                return Ok(new MfaEnrollResponseDto
                {
                    Secret = pendingSecret,
                    OtpauthUri = pendingUri,
                });
            }

            var secret = _totp.GenerateBase32Secret();
            user.TotpSecretEncrypted = _totp.EncryptSecret(secret);
            user.TotpLastUsedStep = 0;
            user.RecoveryCodeHashes = null;
            await _mfaStore.SaveAsync();

            var uri = _totp.BuildOtpauthUri(user.Email ?? string.Empty, secret);
            return Ok(new MfaEnrollResponseDto { Secret = secret, OtpauthUri = uri });
        }

        // ── Enroll confirm (step 2 of setup) ────────────────────────────
        [HttpPost("enroll/confirm")]
        public async Task<IActionResult> ConfirmEnroll([FromBody] MfaCodeRequestDto dto)
        {
            var uid = Uid;
            if (string.IsNullOrEmpty(uid))
                return Unauthorized(new { Message = "No user ID found in token." });

            var user = await _mfaStore.FindUserAsync(uid);
            if (user == null)
                return NotFound(new { Message = "No user profile found for this account." });

            if (user.TotpEnabled)
                return Conflict(new { Message = "TOTP is already enabled for this account." });

            if (string.IsNullOrEmpty(user.TotpSecretEncrypted))
                return BadRequest(new { Message = "No pending enrollment. Call /enroll first." });

            if (IsAttemptLimitExceeded(uid))
                return TooManyAttempts();
            var verification = _totp.VerifyTotpCode(user.TotpSecretEncrypted, dto.Code, user.TotpLastUsedStep);
            if (!verification.Success)
                return RecordInvalidCode(uid);

            _attemptLimiter.RecordSuccess(uid);
            var recovery = _totp.GenerateRecoveryCodes();
            user.TotpEnabled = true;
            user.TotpLastUsedStep = verification.UsedStep;
            user.RecoveryCodeHashes = recovery.Hashes.ToList();
            await _mfaStore.SaveAsync();

            var profile = await LoadProfileAsync(uid);
            if (profile == null || profile.IsActive != true)
                return Unauthorized(new { Message = "Your account is not active." });
            var tokens = _sessionTokens.IssueSessionTokens(uid, profile.Role, profile.Email);

            _logger.LogInformation("TOTP enabled for UID {Uid}", uid);

            // Security email — fire-and-forget into the background queue.
            if (!string.IsNullOrEmpty(user.Email))
            {
                var content = EmailTemplates.MfaEnabled(ThesisAuthorNames.FormatPersonName(user), DateTime.UtcNow);
                _email.Queue(user.Email!, content.Subject, content.Html, content.Text);
            }

            return Ok(new MfaConfirmEnrollResponseDto
            {
                RecoveryCodes = recovery.PlainCodes,
                AccessToken = tokens.AccessToken,
                RefreshToken = tokens.RefreshToken,
                ExpiresAt = tokens.ExpiresAt,
                User = profile,
            });
        }

        // ── Disable ─────────────────────────────────────────────────────
        [HttpPost("disable")]
        public async Task<IActionResult> Disable([FromBody] MfaCodeRequestDto dto)
        {
            var uid = Uid;
            if (string.IsNullOrEmpty(uid))
                return Unauthorized(new { Message = "No user ID found in token." });

            var user = await _mfaStore.FindUserAsync(uid);
            if (user == null)
                return NotFound(new { Message = "No user profile found for this account." });

            if (!user.TotpEnabled || string.IsNullOrEmpty(user.TotpSecretEncrypted))
                return BadRequest(new { Message = "TOTP is not enabled for this account." });

            if (IsAttemptLimitExceeded(uid))
                return TooManyAttempts();
            var verification = _totp.VerifyTotpCode(user.TotpSecretEncrypted, dto.Code, user.TotpLastUsedStep);
            if (!verification.Success)
                return RecordInvalidCode(uid);

            _attemptLimiter.RecordSuccess(uid);
            user.TotpEnabled = false;
            user.TotpSecretEncrypted = null;
            user.TotpLastUsedStep = 0;
            user.RecoveryCodeHashes = null;
            await _mfaStore.SaveAsync();

            _logger.LogInformation("TOTP disabled for UID {Uid}", uid);

            // Security email — fire-and-forget into the background queue.
            if (!string.IsNullOrEmpty(user.Email))
            {
                var content = EmailTemplates.MfaDisabled(ThesisAuthorNames.FormatPersonName(user), DateTime.UtcNow);
                _email.Queue(user.Email!, content.Subject, content.Html, content.Text);
            }

            return Ok(new { Message = "Two-factor authentication disabled." });
        }

        // ── Regenerate recovery codes ───────────────────────────────────
        [HttpPost("recovery-codes/regenerate")]
        public async Task<IActionResult> RegenerateRecoveryCodes([FromBody] MfaCodeRequestDto dto)
        {
            var uid = Uid;
            if (string.IsNullOrEmpty(uid))
                return Unauthorized(new { Message = "No user ID found in token." });

            var user = await _mfaStore.FindUserAsync(uid);
            if (user == null)
                return NotFound(new { Message = "No user profile found for this account." });

            if (!user.TotpEnabled || string.IsNullOrEmpty(user.TotpSecretEncrypted))
                return BadRequest(new { Message = "TOTP is not enabled for this account." });

            if (IsAttemptLimitExceeded(uid))
                return TooManyAttempts();
            var verification = _totp.VerifyTotpCode(user.TotpSecretEncrypted, dto.Code, user.TotpLastUsedStep);
            if (!verification.Success)
                return RecordInvalidCode(uid);

            _attemptLimiter.RecordSuccess(uid);
            var recovery = _totp.GenerateRecoveryCodes();
            user.RecoveryCodeHashes = recovery.Hashes.ToList();
            user.TotpLastUsedStep = verification.UsedStep;
            await _mfaStore.SaveAsync();

            return Ok(new MfaRegenerateResponseDto { RecoveryCodes = recovery.PlainCodes });
        }

        // ── Verify (login step 2) ───────────────────────────────────────
        // Anonymous: authenticated by the pending token in the body, not a
        // Bearer header. Accepts a TOTP code or a single-use recovery code.
        [HttpPost("verify")]
        [AllowAnonymous]
        public async Task<IActionResult> Verify([FromBody] MfaVerifyRequestDto dto)
        {
            var pending = _sessionTokens.ValidatePendingToken(dto.PendingToken);
            if (pending == null)
                return Unauthorized(new { Message = "Your sign-in session expired. Please sign in again." });

            var uid = pending.Uid;
            // Gate first so a locked-out user can't burn more attempts, then
            // count only real failures so a correct code on attempt 3 clears
            // the window instead of being blocked by earlier typos.
            if (_attemptLimiter.WouldBlock(uid))
            {
                _logger.LogWarning("MFA verify rate limit exceeded for UID {Uid}", uid);
                return StatusCode(StatusCodes.Status429TooManyRequests,
                    new { Message = "Too many attempts. Please try again in a few minutes." });
            }

            var user = await _mfaStore.FindUserAsync(uid);
            if (user == null || user.IsActive != true || !user.TotpEnabled || string.IsNullOrEmpty(user.TotpSecretEncrypted))
                return Unauthorized(new { Message = "Your sign-in session expired. Please sign in again." });
            var profile = await LoadProfileAsync(uid);
            if (profile == null || profile.IsActive != true)
                return Unauthorized(new { Message = "Your account is not active." });

            var verification = _totp.VerifyTotpCode(user.TotpSecretEncrypted, dto.Code, user.TotpLastUsedStep);
            if (verification.Success)
            {
                user.TotpLastUsedStep = verification.UsedStep;
            }
            else
            {
                // Fall back to a recovery code (single-use; hash removed on success).
                var recovery = user.RecoveryCodeHashes != null
                    ? _totp.VerifyRecoveryCode(dto.Code, user.RecoveryCodeHashes)
                    : null;
                if (recovery == null || !recovery.Success)
                {
                    _logger.LogWarning("MFA verify failed for UID {Uid}", uid);
                    if (!_attemptLimiter.RecordFailure(uid))
                        return StatusCode(StatusCodes.Status429TooManyRequests,
                            new { Message = "Too many attempts. Please try again in a few minutes." });
                    return Unauthorized(new { Message = "Invalid code." });
                }
                user.RecoveryCodeHashes = recovery.RemainingHashes?.ToList();
            }

            await _mfaStore.SaveAsync();
            _attemptLimiter.RecordSuccess(uid);

            var tokens = _sessionTokens.IssueSessionTokens(uid, profile.Role, profile.Email);
            _logger.LogInformation("MFA verify succeeded for UID {Uid}", uid);

            return Ok(new MfaVerifyResponseDto
            {
                AccessToken = tokens.AccessToken,
                RefreshToken = tokens.RefreshToken,
                ExpiresAt = tokens.ExpiresAt,
                User = profile,
            });
        }

        // ── Refresh (stateless rotation) ────────────────────────────────
        [HttpPost("/api/v1/auth/refresh")]
        [AllowAnonymous]
        public async Task<IActionResult> Refresh([FromBody] RefreshRequestDto dto)
        {
            var refresh = _sessionTokens.ValidateRefreshToken(dto.RefreshToken);
            if (refresh == null)
                return Unauthorized(new { Message = "Invalid or expired refresh token." });

            var profile = await LoadProfileAsync(refresh.Uid);
            if (profile == null || profile.IsActive != true)
                return Unauthorized(new { Message = "Account is not active." });

            // A TOTP-enabled user must still be TOTP-enabled to refresh; if
            // MFA was disabled in another session, drop them back to Firebase login.
            if (!profile.TotpEnabled)
                return Unauthorized(new { Message = "Multi-factor authentication is no longer enabled. Please sign in again." });

            var tokens = _sessionTokens.IssueSessionTokens(refresh.Uid, profile.Role, profile.Email);
            return Ok(new RefreshResponseDto
            {
                AccessToken = tokens.AccessToken,
                RefreshToken = tokens.RefreshToken,
                ExpiresAt = tokens.ExpiresAt,
            });
        }

        private async Task<UserResponseDto?> LoadProfileAsync(string uid)
        {
            // Same probe order as AuthController.GetCurrentUser. Uses the
            // uniform GetByIdAsync for students (not GetProfileByIdAsync,
            // which returns a distinct StudentResponseDto type).
            return await _studentService.GetByIdAsync(uid)
                ?? await _facultyService.GetByIdAsync(uid)
                ?? await _adminService.GetByIdAsync(uid)
                ?? await _programHeadService.GetByIdAsync(uid);
        }

        private bool IsAttemptLimitExceeded(string uid)
        {
            if (!_attemptLimiter.WouldBlock(uid))
                return false;
            _logger.LogWarning("MFA verification rate limit exceeded for UID {Uid}", uid);
            return true;
        }

        private IActionResult RecordInvalidCode(string uid)
        {
            _logger.LogWarning("MFA code verification failed for UID {Uid}", uid);
            return _attemptLimiter.RecordFailure(uid)
                ? BadRequest(new { Message = "Invalid code. Try again." })
                : TooManyAttempts();
        }

        private IActionResult TooManyAttempts()
            => StatusCode(StatusCodes.Status429TooManyRequests,
                new { Message = "Too many attempts. Please try again in a few minutes." });
    }
}
