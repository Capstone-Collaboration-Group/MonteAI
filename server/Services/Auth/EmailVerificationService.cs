using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.Entities;
using server.Services.Interfaces;

namespace server.Services.Auth
{
    public class EmailVerificationService : IEmailVerificationService
    {
        private static readonly TimeSpan OtpLifetime = TimeSpan.FromMinutes(5);
        private static readonly TimeSpan ResendWindow = TimeSpan.FromMinutes(15);
        private readonly AppDbContext _db;
        private readonly IEmailSender _emailSender;

        public EmailVerificationService(AppDbContext db, IEmailSender emailSender)
        {
            _db = db;
            _emailSender = emailSender;
        }

        public async Task<bool> IssueOtpAsync(string email, CancellationToken cancellationToken = default)
        {
            var user = await FindByEmailAsync(email, cancellationToken);
            if (user == null || user.IsEmailVerified) return false;

            var now = DateTime.UtcNow;
            if (user.OtpWindowStartedAt.HasValue && now - user.OtpWindowStartedAt < ResendWindow && user.OtpResendCount >= 3)
                throw new InvalidOperationException("Too many resend requests. Please try again later.");
            if (!user.OtpWindowStartedAt.HasValue || now - user.OtpWindowStartedAt >= ResendWindow)
            {
                user.OtpWindowStartedAt = now;
                user.OtpResendCount = 0;
            }

            user.OtpCode = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
            user.OtpExpiresAt = now.Add(OtpLifetime);
            user.OtpResendCount++;
            user.UpdatedAt = now;
            await _db.SaveChangesAsync(cancellationToken);
            await _emailSender.SendOtpAsync(user.Email!, user.OtpCode, cancellationToken);
            return true;
        }

        public async Task<(bool Success, string? Error)> VerifyOtpAsync(string email, string code, CancellationToken cancellationToken = default)
        {
            var user = await FindByEmailAsync(email, cancellationToken);
            if (user == null) return (false, "The verification code is invalid.");
            if (user.IsEmailVerified) return (true, null);
            if (string.IsNullOrWhiteSpace(user.OtpCode) || user.OtpExpiresAt <= DateTime.UtcNow)
                return (false, "This verification code has expired. Please request a new one.");
            if (!CryptographicOperations.FixedTimeEquals(
                    System.Text.Encoding.UTF8.GetBytes(user.OtpCode),
                    System.Text.Encoding.UTF8.GetBytes(code.Trim())))
                return (false, "The verification code is incorrect.");

            user.IsEmailVerified = true;
            user.OtpCode = null;
            user.OtpExpiresAt = null;
            user.OtpWindowStartedAt = null;
            user.OtpResendCount = 0;
            user.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
            return (true, null);
        }

        private async Task<server.Models.Entities.User?> FindByEmailAsync(string email, CancellationToken cancellationToken)
        {
            var normalized = email.Trim().ToLower();
            var student = await _db.Students.FirstOrDefaultAsync(x => x.Email != null && x.Email.ToLower() == normalized, cancellationToken);
            if (student != null) return student;
            var faculty = await _db.Faculties.FirstOrDefaultAsync(x => x.Email != null && x.Email.ToLower() == normalized, cancellationToken);
            if (faculty != null) return faculty;
            var programHead = await _db.ProgramHeads.FirstOrDefaultAsync(x => x.Email != null && x.Email.ToLower() == normalized, cancellationToken);
            if (programHead != null) return programHead;
            return await _db.Admins.FirstOrDefaultAsync(x => x.Email != null && x.Email.ToLower() == normalized, cancellationToken);
        }
    }
}