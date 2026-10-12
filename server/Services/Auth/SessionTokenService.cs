using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using server.Configuration;
using server.Services.Interfaces;

namespace server.Services.Auth
{
    public class SessionTokenService : ISessionTokenService
    {
        public const string PendingTokenType = "mfa_pending";
        public const string AccessTokenType = "access";
        public const string RefreshTokenType = "refresh";

        // Not the JWT "typ" header parameter (reserved) and not "typ" either —
        // JwtSecurityTokenHandler's inbound claim-type map rewrites and drops
        // it on read, so Validate sees nothing. This name has no mapping
        // entry, so it round-trips verbatim.
        private const string TokenTypeClaim = "token_kind";

        private readonly AuthOptions _options;
        private readonly byte[] _signingKeyBytes;

        public SessionTokenService(IOptions<AuthOptions> options)
        {
            _options = options.Value;
            if (string.IsNullOrWhiteSpace(_options.JwtSigningKey))
                throw new InvalidOperationException("Auth:JwtSigningKey is not configured.");

            try
            {
                _signingKeyBytes = Convert.FromBase64String(_options.JwtSigningKey);
            }
            catch (FormatException ex)
            {
                throw new InvalidOperationException("Auth:JwtSigningKey must be a base64-encoded 256-bit key.", ex);
            }
            if (_signingKeyBytes.Length < 32)
                throw new InvalidOperationException("Auth:JwtSigningKey must contain at least 256 bits.");
        }

        public string IssuePendingToken(string uid)
            => CreateToken(uid, role: null, email: null, PendingTokenType,
                expires: null);

        public SessionTokenPair IssueSessionTokens(string uid, string role, string email)
        {
            var expiresAt = DateTimeOffset.UtcNow.AddMinutes(_options.AccessTokenMinutes);
            var access = CreateToken(uid, role, email, AccessTokenType, expiresAt);
            // Refresh tokens are compared across rotations and must differ
            // between issuances. A nonce does that without a store: the token
            // is self-contained and stateless, so no server-side record exists
            // to check revocation against.
            var refresh = CreateToken(uid, role, email, RefreshTokenType,
                DateTimeOffset.UtcNow.AddDays(_options.RefreshTokenDays),
                nonce: Convert.ToHexString(RandomNumberGenerator.GetBytes(16)));
            return new SessionTokenPair(access, refresh, expiresAt);
        }

        public PendingTokenClaims? ValidatePendingToken(string token)
        {
            var result = Validate(token, PendingTokenType);
            if (result is null) return null;
            var claims = result.Value;
            return new PendingTokenClaims(claims.Uid);
        }

        public SessionTokenClaims? ValidateAccessToken(string token)
        {
            var result = Validate(token, AccessTokenType);
            if (result is null) return null;
            var claims = result.Value;
            return new SessionTokenClaims(claims.Uid, claims.Role!, claims.Email);
        }

        public RefreshTokenClaims? ValidateRefreshToken(string token)
        {
            var result = Validate(token, RefreshTokenType);
            if (result is null) return null;
            var claims = result.Value;
            return new RefreshTokenClaims(claims.Uid, claims.Role!);
        }

        private (string Uid, string? Role, string? Email)? Validate(string token, string expectedType)
        {
            try
            {
                var parts = token.Split('.');
                if (parts.Length != 3) return null;

                using var hmac = new HMACSHA256(_signingKeyBytes);
                var expectedSignature = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{parts[0]}.{parts[1]}"));
                var suppliedSignature = Base64UrlEncoder.DecodeBytes(parts[2]);
                if (expectedSignature.Length != suppliedSignature.Length
                    || !CryptographicOperations.FixedTimeEquals(expectedSignature, suppliedSignature))
                    return null;

                using var header = JsonDocument.Parse(Base64UrlDecodeToString(parts[0]));
                if (!header.RootElement.TryGetProperty("alg", out var algorithm)
                    || algorithm.GetString() != SecurityAlgorithms.HmacSha256
                    || !header.RootElement.TryGetProperty("typ", out var tokenFormat)
                    || tokenFormat.GetString() != "JWT")
                    return null;

                using var payload = JsonDocument.Parse(Base64UrlDecodeToString(parts[1]));
                var root = payload.RootElement;

                string? Claim(string name)
                    => root.TryGetProperty(name, out var v)
                        ? v.ValueKind == JsonValueKind.String ? v.GetString() : v.ToString()
                        : null;

                if (Claim(TokenTypeClaim) != expectedType) return null;
                if (Claim("iss") != _options.Issuer || Claim("aud") != _options.Audience)
                    return null;
                if (!root.TryGetProperty("exp", out var expiryClaim)
                    || !expiryClaim.TryGetInt64(out var expirySeconds)
                    || !root.TryGetProperty("nbf", out var notBeforeClaim)
                    || !notBeforeClaim.TryGetInt64(out var notBeforeSeconds))
                    return null;

                var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                const long clockSkewSeconds = 30;
                if (expirySeconds <= notBeforeSeconds
                    || now > expirySeconds + clockSkewSeconds
                    || now + clockSkewSeconds < notBeforeSeconds)
                    return null;

                var uid = Claim("uid") ?? Claim(ClaimTypes.NameIdentifier);
                if (string.IsNullOrEmpty(uid)) return null;

                var role = Claim("role") ?? Claim(ClaimTypes.Role);
                if (expectedType != PendingTokenType && string.IsNullOrEmpty(role))
                    return null;
                return (uid, role, Claim("email") ?? Claim(ClaimTypes.Email));
            }
            catch (Exception ex) when (ex is ArgumentException
                or FormatException
                or JsonException
                or InvalidOperationException
                or OverflowException)
            {
                // Not a valid MonteAI session token; the middleware can try
                // Firebase verification for raw Firebase ID tokens.
                return null;
            }
        }

        private string CreateToken(string uid, string? role, string? email, string type, DateTimeOffset? expires, string? nonce = null)
        {
            // Every token type gets an exp — a pending token with no expiry
            // would stay valid forever instead of the short PendingTokenMinutes.
            var expiry = expires ?? DateTimeOffset.UtcNow.AddMinutes(_options.PendingTokenMinutes);
            var now = DateTimeOffset.UtcNow;

            // Payload is serialized by hand. This TFM's JwtPayload only accepts
            // IEnumerable<Claim>, and string claims round-trip as JSON strings —
            // which lifetime and issuer validation reject (IDX10225/IDX10211).
            // Serializing the dictionary directly keeps exp/iss/aud as real
            // JSON primitives. SecurityTokenDescriptor.Expires is also unreliable
            // across the JwtBearer 8.0.10 / Tokens 8.14.0 / Jwt 7.1.2 skew here.
            var payload = new Dictionary<string, object>
            {
                ["uid"] = uid,
                // Not the JWT "typ" header parameter — that is reserved, and
                // FindFirst (payload claims) cannot see it after round-trip.
                [TokenTypeClaim] = type,
                ["nbf"] = now.ToUnixTimeSeconds(),
                ["iat"] = now.ToUnixTimeSeconds(),
                ["exp"] = expiry.ToUnixTimeSeconds(),
                ["iss"] = _options.Issuer,
                ["aud"] = _options.Audience,
            };
            if (!string.IsNullOrEmpty(role))
                payload["role"] = role;
            if (!string.IsNullOrEmpty(email))
                payload["email"] = email;
            if (!string.IsNullOrEmpty(nonce))
                payload["jti"] = nonce;

            var payloadJson = System.Text.Json.JsonSerializer.Serialize(payload);
            var headerJson = $"{{\"alg\":\"{SecurityAlgorithms.HmacSha256}\",\"typ\":\"JWT\"}}";
            var header64 = Base64UrlEncoder.Encode(Encoding.UTF8.GetBytes(headerJson));
            var payload64 = Base64UrlEncoder.Encode(Encoding.UTF8.GetBytes(payloadJson));
            var signingInput = $"{header64}.{payload64}";
            using var hmac = new HMACSHA256(_signingKeyBytes);
            var signature = Base64UrlEncoder.Encode(hmac.ComputeHash(Encoding.UTF8.GetBytes(signingInput)));
            return $"{signingInput}.{signature}";
        }

        private static string Base64UrlDecodeToString(string input)
        {
            var s = input.Replace('-', '+').Replace('_', '/');
            switch (s.Length % 4)
            {
                case 2: s += "=="; break;
                case 3: s += "="; break;
            }
            return Encoding.UTF8.GetString(Convert.FromBase64String(s));
        }
    }
}
