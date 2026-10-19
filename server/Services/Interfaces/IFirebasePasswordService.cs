namespace server.Services.Interfaces
{
    /// <summary>
    /// Server-managed password operations against Firebase Auth — powers
    /// POST /auth/change-password (verify current + write new) so the server
    /// can emit the "password changed" security email from one trusted place.
    /// </summary>
    public interface IFirebasePasswordService
    {
        /// <summary>
        /// Checks email + currentPassword against the Firebase Auth REST API.
        /// Returns false on wrong credentials or API failure (never throws for
        /// bad input).
        /// </summary>
        Task<bool> VerifyCurrentPasswordAsync(string email, string password, CancellationToken cancellationToken = default);

        /// <summary>Writes the new password via the Firebase Admin SDK.</summary>
        Task UpdatePasswordAsync(string uid, string newPassword, CancellationToken cancellationToken = default);
    }
}
