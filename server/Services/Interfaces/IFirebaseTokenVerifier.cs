namespace server.Services.Interfaces
{
    // Seam over FirebaseAdmin's static FirebaseAuth.DefaultInstance so
    // integration tests can substitute a fake verifier.
    public interface IFirebaseTokenVerifier
    {
        Task<FirebaseVerifiedToken?> VerifyAsync(string idToken);
    }

    public sealed record FirebaseVerifiedToken(string Uid, string? Email, bool EmailVerified);
}
