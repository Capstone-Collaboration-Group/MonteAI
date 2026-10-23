using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.DataProtection;
using OtpNet;
using server.Services.Interfaces;

namespace server.Services.Auth
{
    public class TotpService : ITotpService
    {
        public const string ProtectorPurpose = "MonteAI.TotpSecret.v1";
        private const int StepSeconds = 30;
        private const int TotpDigits = 6;
        private const int AllowedDriftSteps = 1;
        private const int SecretBytes = 20; // 160-bit RFC 4226 recommendation
        private const int RecoveryCodeCount = 8;
        private const int RecoveryCodeGroups = 2;
        private const int RecoveryCodeGroupSize = 5;
        // Crockford-style Base32 minus I, L, O, U (ambiguous glyphs).
        private const string RecoveryAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

        private readonly IDataProtector _protector;

        public TotpService(IDataProtectionProvider dataProtection)
        {
            _protector = dataProtection.CreateProtector(ProtectorPurpose);
        }

        public string GenerateBase32Secret()
        {
            var bytes = RandomNumberGenerator.GetBytes(SecretBytes);
            return Base32Encoding.ToString(bytes);
        }

        public string BuildOtpauthUri(string email, string base32Secret)
        {
            var label = Uri.EscapeDataString($"MonteAI:{email}");
            var issuer = Uri.EscapeDataString("MonteAI");
            return $"otpauth://totp/{label}?secret={base32Secret}&issuer={issuer}&algorithm=SHA1&digits={TotpDigits}&period={StepSeconds}";
        }

        public string EncryptSecret(string base32Secret)
            => _protector.Protect(base32Secret);

        public string DecryptSecret(string encryptedSecret)
            => _protector.Unprotect(encryptedSecret);

        public TotpStepVerification VerifyTotpCode(string encryptedSecret, string code, long lastUsedStep)
        {
            if (string.IsNullOrWhiteSpace(code))
                return new TotpStepVerification { Success = false };

            var normalized = code.Trim().Replace(" ", string.Empty);
            if (normalized.Length != TotpDigits || !normalized.All(char.IsDigit))
                return new TotpStepVerification { Success = false };

            byte[] secretBytes;
            try
            {
                secretBytes = Base32Encoding.ToBytes(DecryptSecret(encryptedSecret));
            }
            catch (CryptographicException)
            {
                // Secret cannot be decrypted (key ring rotated / tampered).
                return new TotpStepVerification { Success = false };
            }

            var totp = new Totp(secretBytes, step: StepSeconds, mode: OtpHashMode.Sha1, totpSize: TotpDigits);
            // ±1 step window (one step back, one step forward).
            var window = new VerificationWindow(1, 1);
            if (!totp.VerifyTotp(normalized, out var timestepModified, window))
                return new TotpStepVerification { Success = false };

            // Replay protection: reject any code at or below the last accepted step.
            if (timestepModified <= lastUsedStep)
                return new TotpStepVerification { Success = false };

            return new TotpStepVerification { Success = true, UsedStep = timestepModified };
        }

        public RecoveryCodeSet GenerateRecoveryCodes()
        {
            var plain = new List<string>(RecoveryCodeCount);
            var hashes = new List<string>(RecoveryCodeCount);
            for (var i = 0; i < RecoveryCodeCount; i++)
            {
                var code = GenerateOneRecoveryCode();
                plain.Add(code);
                hashes.Add(HashRecoveryCode(code));
            }
            return new RecoveryCodeSet { PlainCodes = plain, Hashes = hashes };
        }

        public RecoveryCodeVerification VerifyRecoveryCode(string code, IReadOnlyList<string> storedHashes)
        {
            if (string.IsNullOrWhiteSpace(code) || storedHashes == null || storedHashes.Count == 0)
                return new RecoveryCodeVerification { Success = false };

            var candidate = NormalizeRecoveryCode(code);
            var candidateHash = HashRecoveryCode(candidate);

            string? matchedHash = null;
            foreach (var stored in storedHashes)
            {
                if (FixedTimeEquals(stored, candidateHash))
                {
                    matchedHash = stored;
                    break;
                }
            }

            if (matchedHash == null)
                return new RecoveryCodeVerification { Success = false };

            var remaining = storedHashes.Where(h => h != matchedHash).ToList();
            return new RecoveryCodeVerification { Success = true, RemainingHashes = remaining };
        }

        public string HashRecoveryCode(string code)
        {
            var normalized = NormalizeRecoveryCode(code);
            var digest = SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
            return Convert.ToHexString(digest);
        }

        private static string GenerateOneRecoveryCode()
        {
            var groups = new string[RecoveryCodeGroups];
            for (var g = 0; g < RecoveryCodeGroups; g++)
            {
                var chars = new char[RecoveryCodeGroupSize];
                for (var i = 0; i < RecoveryCodeGroupSize; i++)
                {
                    // Rejection sampling keeps the distribution uniform over the alphabet.
                    int b;
                    do { b = RandomNumberGenerator.GetInt32(256); }
                    while (b >= 256 - (256 % RecoveryAlphabet.Length));
                    chars[i] = RecoveryAlphabet[b % RecoveryAlphabet.Length];
                }
                groups[g] = new string(chars);
            }
            return string.Join("-", groups);
        }

        private static string NormalizeRecoveryCode(string code)
            => code.Trim().Replace("-", string.Empty).Replace(" ", string.Empty).ToUpperInvariant();

        private static bool FixedTimeEquals(string a, string b)
        {
            var ba = Encoding.UTF8.GetBytes(a);
            var bb = Encoding.UTF8.GetBytes(b);
            return ba.Length == bb.Length && CryptographicOperations.FixedTimeEquals(ba, bb);
        }
    }
}
