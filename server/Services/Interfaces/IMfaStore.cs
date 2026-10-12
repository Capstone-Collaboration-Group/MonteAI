using UserEntity = server.Models.Entities.User;

namespace server.Services.Interfaces
{
    // Locates the single User row (across the four TPC role tables) and
    // persists TOTP state. Returns the tracked entity so callers can mutate
    // the TOTP fields and call SaveAsync.
    public interface IMfaStore
    {
        Task<UserEntity?> FindUserAsync(string uid);
        Task SaveAsync();
    }
}
