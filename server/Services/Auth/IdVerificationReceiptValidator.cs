using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using server.Configuration;
using server.Services.Interfaces;

namespace server.Services.Auth;

public sealed class IdVerificationReceiptValidator : IIdVerificationReceiptValidator, IDisposable
{
    private const string ReceiptType = "monteai-idv+jwt";
    private const string Purpose = "student-registration";
    private const string NormalizationVersion = "latin-v1";
    private const long ReceiptVersion = 1;
    private const int MaximumReceiptLength = 4096;

    private static readonly HashSet<string> ExpectedHeaderClaims =
        ["alg", "typ", "kid"];

    private static readonly HashSet<string> ExpectedPayloadClaims =
    [
        "iss", "aud", "sub", "email", "email_verified", "iat", "nbf", "exp", "jti",
        "purpose", "version", "name_normalization", "student_number", "name_key", "template_id",
    ];

    private readonly IdVerificationOptions _options;
    private readonly ILogger<IdVerificationReceiptValidator> _logger;
    private readonly Dictionary<string, RsaSecurityKey> _keys = new(StringComparer.Ordinal);
    private readonly HashSet<string> _allowedTemplateIds;
    private readonly bool _configurationValid;

    public IdVerificationReceiptValidator(
        IOptions<IdVerificationOptions> options,
        ILogger<IdVerificationReceiptValidator> logger)
    {
        _options = options.Value;
        _logger = logger;
        _allowedTemplateIds = new HashSet<string>(
            _options.AllowedTemplateIds.Where(value => !string.IsNullOrWhiteSpace(value)),
            StringComparer.Ordinal);

        var valid = !string.IsNullOrWhiteSpace(_options.Issuer) &&
                    !string.IsNullOrWhiteSpace(_options.Audience) &&
                    _options.ClockSkewSeconds is >= 0 and <= 60 &&
                    _options.MaximumReceiptLifetimeSeconds is >= 1 and <= 600 &&
                    _allowedTemplateIds.Count > 0;

        foreach (var configuredKey in _options.PublicKeys)
        {
            if (!TryLoadKey(configuredKey, out var key) || !_keys.TryAdd(configuredKey.KeyId, key))
            {
                key?.Rsa?.Dispose();
                valid = false;
                continue;
            }
        }

        _configurationValid = valid && _keys.Count > 0;
        if (!_configurationValid)
            _logger.LogError("ID verification receipt validation is not configured correctly");
    }

    public bool TryValidate(
        string? receipt,
        StudentRegistrationIdentity expectedIdentity,
        out VerifiedIdVerificationReceipt? verifiedReceipt)
    {
        verifiedReceipt = null;
        if (!_configurationValid ||
            string.IsNullOrWhiteSpace(receipt) ||
            receipt.Length > MaximumReceiptLength)
            return Reject("configuration-or-input");

        try
        {
            var segments = receipt.Split('.');
            if (segments.Length != 3 || segments.Any(string.IsNullOrEmpty))
                return Reject("compact-token");

            using var headerDocument = JsonDocument.Parse(
                Base64UrlEncoder.DecodeBytes(segments[0]));
            var header = headerDocument.RootElement;
            if (!HasExactProperties(header, ExpectedHeaderClaims) ||
                !TryGetString(header, "alg", out var algorithm) ||
                !string.Equals(algorithm, SecurityAlgorithms.RsaSha256, StringComparison.Ordinal) ||
                !TryGetString(header, "typ", out var tokenType) ||
                !string.Equals(tokenType, ReceiptType, StringComparison.Ordinal) ||
                !TryGetString(header, "kid", out var keyId) ||
                keyId.Length is < 1 or > 128 ||
                !_keys.TryGetValue(keyId, out var signingKey))
                return Reject("header");

            var signingInput = Encoding.ASCII.GetBytes($"{segments[0]}.{segments[1]}");
            var signature = Base64UrlEncoder.DecodeBytes(segments[2]);
            if (signingKey.Rsa is null ||
                !signingKey.Rsa.VerifyData(
                    signingInput,
                    signature,
                    HashAlgorithmName.SHA256,
                    RSASignaturePadding.Pkcs1))
                return Reject("signature");

            using var payloadDocument = JsonDocument.Parse(
                Base64UrlEncoder.DecodeBytes(segments[1]));
            var payload = payloadDocument.RootElement;
            if (!HasExactProperties(payload, ExpectedPayloadClaims))
                return Reject("payload-shape");

            if (!TryGetString(payload, "iss", out var issuer) ||
                !string.Equals(issuer, _options.Issuer, StringComparison.Ordinal) ||
                !TryGetString(payload, "aud", out var audience) ||
                !string.Equals(audience, _options.Audience, StringComparison.Ordinal) ||
                !TryGetString(payload, "sub", out var subject) ||
                subject.Length is < 1 or > 128 ||
                !TryGetString(payload, "email", out var email) ||
                email.Length is < 3 or > 254 ||
                !TryGetBoolean(payload, "email_verified", out var emailVerified) ||
                !emailVerified ||
                !TryGetString(payload, "jti", out var jti) ||
                !Guid.TryParseExact(jti, "D", out _) ||
                !TryGetString(payload, "purpose", out var purpose) ||
                !string.Equals(purpose, Purpose, StringComparison.Ordinal) ||
                !TryGetInt64(payload, "version", out var version) ||
                version != ReceiptVersion ||
                !TryGetString(payload, "name_normalization", out var normalization) ||
                !string.Equals(normalization, NormalizationVersion, StringComparison.Ordinal) ||
                !TryGetString(payload, "student_number", out var studentNumber) ||
                !TryGetString(payload, "name_key", out var nameKey) ||
                !TryGetString(payload, "template_id", out var templateId) ||
                !_allowedTemplateIds.Contains(templateId) ||
                !TryGetInt64(payload, "iat", out var issuedAt) ||
                !TryGetInt64(payload, "nbf", out var notBefore) ||
                !TryGetInt64(payload, "exp", out var expiresAt) ||
                issuedAt != notBefore ||
                expiresAt <= issuedAt ||
                expiresAt - issuedAt > _options.MaximumReceiptLifetimeSeconds)
                return Reject("claims");

            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            if (issuedAt > now + _options.ClockSkewSeconds ||
                notBefore > now + _options.ClockSkewSeconds ||
                expiresAt <= now - _options.ClockSkewSeconds ||
                !string.Equals(subject, expectedIdentity.FirebaseUid, StringComparison.Ordinal) ||
                !string.Equals(
                    StudentRegistrationIdentityNormalizer.NormalizeEmail(email),
                    expectedIdentity.Email,
                    StringComparison.Ordinal) ||
                !string.Equals(studentNumber, expectedIdentity.StudentNumber, StringComparison.Ordinal) ||
                !string.Equals(nameKey, expectedIdentity.NameKey, StringComparison.Ordinal))
                return Reject("identity-binding");

            verifiedReceipt = new VerifiedIdVerificationReceipt(
                jti,
                subject,
                templateId,
                DateTimeOffset.FromUnixTimeSeconds(expiresAt).UtcDateTime);
            return true;
        }
        catch (Exception error) when (
            error is ArgumentException or FormatException or JsonException or CryptographicException)
        {
            _logger.LogDebug(
                "ID verification receipt rejected while parsing or verifying: {ErrorType}",
                error.GetType().Name);
            return false;
        }
    }

    private bool Reject(string reason)
    {
        _logger.LogDebug("ID verification receipt rejected: {Reason}", reason);
        return false;
    }

    public void Dispose()
    {
        foreach (var key in _keys.Values)
            key.Rsa?.Dispose();
    }

    private static bool TryLoadKey(
        IdVerificationPublicKeyOptions configuredKey,
        out RsaSecurityKey key)
    {
        key = null!;
        if (string.IsNullOrWhiteSpace(configuredKey.KeyId) ||
            configuredKey.KeyId.Length > 128 ||
            string.IsNullOrWhiteSpace(configuredKey.PublicKeyPemBase64))
            return false;

        RSA? rsa = null;
        try
        {
            var pemBytes = Convert.FromBase64String(configuredKey.PublicKeyPemBase64);
            var pem = Encoding.UTF8.GetString(pemBytes);
            CryptographicOperations.ZeroMemory(pemBytes);
            if (!pem.Contains("-----BEGIN PUBLIC KEY-----", StringComparison.Ordinal) ||
                pem.Contains("PRIVATE KEY", StringComparison.Ordinal))
                return false;

            rsa = RSA.Create();
            rsa.ImportFromPem(pem);
            if (rsa.KeySize < 2048)
                return false;

            key = new RsaSecurityKey(rsa) { KeyId = configuredKey.KeyId };
            rsa = null;
            return true;
        }
        catch (Exception error) when (
            error is FormatException or ArgumentException or CryptographicException)
        {
            return false;
        }
        finally
        {
            rsa?.Dispose();
        }
    }

    private static bool HasExactProperties(JsonElement value, HashSet<string> expected)
    {
        if (value.ValueKind != JsonValueKind.Object) return false;

        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var property in value.EnumerateObject())
        {
            if (!expected.Contains(property.Name) || !seen.Add(property.Name))
                return false;
        }

        return seen.SetEquals(expected);
    }

    private static bool TryGetString(
        JsonElement payload,
        string key,
        out string value)
    {
        value = string.Empty;
        if (!payload.TryGetProperty(key, out var raw) ||
            raw.ValueKind != JsonValueKind.String)
            return false;
        value = raw.GetString() ?? string.Empty;
        return true;
    }

    private static bool TryGetBoolean(
        JsonElement payload,
        string key,
        out bool value)
    {
        value = false;
        if (!payload.TryGetProperty(key, out var raw) ||
            raw.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
            return false;
        value = raw.GetBoolean();
        return true;
    }

    private static bool TryGetInt64(
        JsonElement payload,
        string key,
        out long value)
    {
        value = 0;
        return payload.TryGetProperty(key, out var raw) &&
               raw.ValueKind == JsonValueKind.Number &&
               long.TryParse(
                   raw.GetRawText(),
                   NumberStyles.None,
                   CultureInfo.InvariantCulture,
                   out value);
    }
}
