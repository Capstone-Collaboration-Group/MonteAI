namespace server.Services.Interfaces;

public interface IResponseCache
{
    Task<T?> GetOrCreateAsync<T>(
        string region,
        string key,
        TimeSpan expiration,
        Func<CancellationToken, Task<T?>> factory,
        CancellationToken cancellationToken = default)
        where T : class;

    Task InvalidateAsync(params string[] regions);
}
