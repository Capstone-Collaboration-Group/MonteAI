namespace server.Services.Interfaces;

public sealed record StudentRegistrationIdentity(
    string FirebaseUid,
    string Email,
    string StudentNumber,
    string FirstName,
    string MiddleInitial,
    string LastName,
    string Suffix)
{
    public string NameKey => string.Join('|', FirstName, MiddleInitial, LastName, Suffix);
}

public sealed record VerifiedIdVerificationReceipt(
    string Jti,
    string FirebaseUid,
    string TemplateId,
    DateTime ExpiresAtUtc);

public interface IIdVerificationReceiptValidator
{
    bool TryValidate(
        string? receipt,
        StudentRegistrationIdentity expectedIdentity,
        out VerifiedIdVerificationReceipt? verifiedReceipt);
}
