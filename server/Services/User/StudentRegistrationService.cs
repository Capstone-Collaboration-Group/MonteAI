using System.Security.Cryptography;
using System.Text;
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.DTOs.User;
using server.Models.Entities;
using server.Services.Interfaces;

namespace server.Services.User;

public sealed class StudentRegistrationService : IStudentRegistrationService
{
    private readonly AppDbContext _db;
    private readonly IMapper _mapper;
    private readonly ILogger<StudentRegistrationService> _logger;

    public StudentRegistrationService(
        AppDbContext db,
        IMapper mapper,
        ILogger<StudentRegistrationService> logger)
    {
        _db = db;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<StudentRegistrationResult> RegisterAsync(
        RegisterUserDto dto,
        VerifiedIdVerificationReceipt receipt,
        CancellationToken cancellationToken = default)
    {
        var fingerprint = RegistrationFingerprint(dto);
        var prior = await _db.ConsumedIdVerificationReceipts
            .AsNoTracking()
            .SingleOrDefaultAsync(row => row.Jti == receipt.Jti, cancellationToken);
        if (prior is not null)
            return await ResolveIdempotentRetryAsync(prior, receipt, fingerprint, cancellationToken);

        if (await _db.Students.AsNoTracking().AnyAsync(student => student.Id == dto.Id, cancellationToken))
            throw new StudentRegistrationConflictException();

        var now = DateTime.UtcNow;
        var student = _mapper.Map<Student>(dto);
        student.Id = dto.Id;
        student.Email = dto.Email.Trim().ToLowerInvariant();
        student.IsActive = true;
        student.PrivacyNoticeVersion = dto.PrivacyNoticeVersion;
        student.PrivacyNoticeAcceptedAt = now;
        student.TermsVersion = dto.TermsVersion;
        student.TermsAcceptedAt = now;
        student.CreatedAt = now;
        student.UpdatedAt = now;

        var consumption = new ConsumedIdVerificationReceipt
        {
            Jti = receipt.Jti,
            FirebaseUid = receipt.FirebaseUid,
            RegistrationFingerprint = fingerprint,
            TemplateId = receipt.TemplateId,
            ConsumedAtUtc = now,
            ExpiresAtUtc = receipt.ExpiresAtUtc,
        };

        _db.Students.Add(student);
        _db.ConsumedIdVerificationReceipts.Add(consumption);
        try
        {
            // EF wraps this single SaveChanges call in one database transaction:
            // neither row can commit without the other.
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // A concurrent retry can race the initial read. Detach the failed
            // inserts and resolve only an actually committed matching JTI.
            _db.ChangeTracker.Clear();
            var concurrent = await _db.ConsumedIdVerificationReceipts
                .AsNoTracking()
                .SingleOrDefaultAsync(row => row.Jti == receipt.Jti, cancellationToken);
            if (concurrent is not null)
                return await ResolveIdempotentRetryAsync(
                    concurrent,
                    receipt,
                    fingerprint,
                    cancellationToken);
            throw new StudentRegistrationConflictException();
        }

        _logger.LogInformation("Verified student registered: {Id}", dto.Id);
        return new StudentRegistrationResult(_mapper.Map<UserResponseDto>(student), true);
    }

    private async Task<StudentRegistrationResult> ResolveIdempotentRetryAsync(
        ConsumedIdVerificationReceipt prior,
        VerifiedIdVerificationReceipt receipt,
        string fingerprint,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(prior.FirebaseUid, receipt.FirebaseUid, StringComparison.Ordinal) ||
            !string.Equals(prior.RegistrationFingerprint, fingerprint, StringComparison.Ordinal))
            throw new StudentRegistrationConflictException();

        var student = await _db.Students
            .AsNoTracking()
            .SingleOrDefaultAsync(value => value.Id == receipt.FirebaseUid, cancellationToken);
        if (student is null)
            throw new StudentRegistrationConflictException();

        return new StudentRegistrationResult(_mapper.Map<UserResponseDto>(student), false);
    }

    private static string RegistrationFingerprint(RegisterUserDto dto)
    {
        var values = new string?[]
        {
            dto.Id,
            dto.Email.Trim().ToLowerInvariant(),
            dto.FirstName.Trim(),
            dto.MiddleInitial?.ToString(),
            dto.LastName.Trim(),
            dto.Suffix?.Trim(),
            dto.Role,
            dto.StudentNumber?.Trim(),
            dto.GroupId?.ToString("D"),
            dto.Position?.Trim(),
            dto.Institute?.Trim(),
            dto.Program?.Trim(),
            dto.YearLevel?.ToString(System.Globalization.CultureInfo.InvariantCulture),
            dto.Section?.Trim(),
            dto.PrivacyNoticeAccepted.ToString(),
            dto.PrivacyNoticeVersion,
            dto.TermsAccepted.ToString(),
            dto.TermsVersion,
        };

        var canonical = new StringBuilder();
        foreach (var value in values)
        {
            if (value is null)
            {
                canonical.Append("-1:");
                continue;
            }
            canonical.Append(value.Length).Append(':').Append(value);
        }

        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical.ToString())));
    }
}

public sealed class StudentRegistrationConflictException : Exception;
