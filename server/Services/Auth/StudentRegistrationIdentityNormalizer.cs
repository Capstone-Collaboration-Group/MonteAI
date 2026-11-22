using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using server.Models.DTOs.User;
using server.Services.Interfaces;

namespace server.Services.Auth;

public static partial class StudentRegistrationIdentityNormalizer
{
    private static readonly HashSet<string> AllowedSuffixes =
        [string.Empty, "JR", "SR", "II", "III", "IV", "V"];

    public static bool TryCreate(
        RegisterUserDto dto,
        string firebaseUid,
        string firebaseEmail,
        out StudentRegistrationIdentity? identity)
    {
        identity = null;
        if (string.IsNullOrWhiteSpace(firebaseUid) || firebaseUid.Length > 128)
            return false;

        var email = NormalizeEmail(dto.Email);
        if (email.Length == 0 ||
            !string.Equals(email, NormalizeEmail(firebaseEmail), StringComparison.Ordinal))
            return false;

        var studentNumber = NormalizeStudentNumber(dto.StudentNumber ?? string.Empty);
        var firstName = NormalizeName(dto.FirstName);
        var middleInitial = dto.MiddleInitial is null
            ? string.Empty
            : NormalizeName(dto.MiddleInitial.Value.ToString());
        var lastName = NormalizeName(dto.LastName);
        var suffix = NormalizeName(dto.Suffix ?? string.Empty);

        if (!StudentNumberPattern().IsMatch(studentNumber) ||
            !NamePattern().IsMatch(firstName) ||
            !NamePattern().IsMatch(lastName) ||
            (middleInitial.Length > 0 && !InitialPattern().IsMatch(middleInitial)) ||
            !AllowedSuffixes.Contains(suffix))
            return false;

        identity = new StudentRegistrationIdentity(
            firebaseUid,
            email,
            studentNumber,
            firstName,
            middleInitial,
            lastName,
            suffix);
        return true;
    }

    public static string NormalizeEmail(string? value) =>
        (value ?? string.Empty).Trim().ToLowerInvariant();

    public static string NormalizeStudentNumber(string value)
    {
        var translated = value
            .Replace('‐', '-')
            .Replace('‑', '-')
            .Replace('‒', '-')
            .Replace('–', '-')
            .Replace('—', '-')
            .Replace('−', '-')
            .Trim();
        return AroundHyphenWhitespace().Replace(translated, "-");
    }

    public static string NormalizeName(string? value)
    {
        var decomposed = (value ?? string.Empty).Normalize(NormalizationForm.FormKD);
        var builder = new StringBuilder(decomposed.Length);
        foreach (var character in decomposed)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(character);
            if (category is UnicodeCategory.NonSpacingMark or
                UnicodeCategory.SpacingCombiningMark or
                UnicodeCategory.EnclosingMark)
                continue;
            builder.Append(char.ToUpperInvariant(character));
        }

        var normalized = JoinPunctuation().Replace(builder.ToString(), string.Empty);
        normalized = SeparatePunctuation().Replace(normalized, " ");
        return RepeatedWhitespace().Replace(normalized, " ").Trim();
    }

    [GeneratedRegex(@"^[0-9]{2}-[0-9]{5}$", RegexOptions.CultureInvariant)]
    private static partial Regex StudentNumberPattern();

    [GeneratedRegex(@"^[A-Z]+(?: [A-Z]+)*$", RegexOptions.CultureInvariant)]
    private static partial Regex NamePattern();

    [GeneratedRegex(@"^[A-Z]$", RegexOptions.CultureInvariant)]
    private static partial Regex InitialPattern();

    [GeneratedRegex(@"\s*-\s*", RegexOptions.CultureInvariant)]
    private static partial Regex AroundHyphenWhitespace();

    [GeneratedRegex("['’\\-]", RegexOptions.CultureInvariant)]
    private static partial Regex JoinPunctuation();

    [GeneratedRegex("[.,]", RegexOptions.CultureInvariant)]
    private static partial Regex SeparatePunctuation();

    [GeneratedRegex(@"\s+", RegexOptions.CultureInvariant)]
    private static partial Regex RepeatedWhitespace();
}
