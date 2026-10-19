using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using StackExchange.Redis;
using server.Services.Interfaces;

namespace server.Services.Caching;

public sealed class ResponseCache(
    IDistributedCache distributedCache,
    ILogger<ResponseCache> logger,
    IHostEnvironment environment) : IResponseCache
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private const string DefaultVersion = "0";
    private readonly string _keyPrefix =
        $"monteai:{environment.EnvironmentName.ToLowerInvariant()}:api-cache";

    public async Task<T?> GetOrCreateAsync<T>(
        string region,
        string key,
        TimeSpan expiration,
        Func<CancellationToken, Task<T?>> factory,
        CancellationToken cancellationToken = default)
        where T : class
    {
        var version = await TryGetVersionAsync(region, cancellationToken);
        if (version is not null)
        {
            var cacheKey = BuildEntryKey(region, version, key);
            try
            {
                var cached = await distributedCache.GetStringAsync(cacheKey, cancellationToken);
                if (cached is not null)
                {
                    try
                    {
                        var value = JsonSerializer.Deserialize<T>(cached, JsonOptions);
                        if (value is not null) return value;
                    }
                    catch (JsonException ex)
                    {
                        logger.LogWarning(ex, "Discarding invalid cached response for region {Region}", region);
                    }

                    await distributedCache.RemoveAsync(cacheKey, cancellationToken);
                }
            }
            catch (RedisException ex)
            {
                logger.LogWarning(ex, "Redis read failed for cache region {Region}; loading from source", region);
                version = null;
            }
        }

        var result = await factory(cancellationToken);
        if (result is null || version is null) return result;

        try
        {
            var cacheKey = BuildEntryKey(region, version, key);
            var serialized = JsonSerializer.Serialize(result, JsonOptions);
            await distributedCache.SetStringAsync(
                cacheKey,
                serialized,
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = expiration },
                cancellationToken);
        }
        catch (RedisException ex)
        {
            logger.LogWarning(ex, "Redis write failed for cache region {Region}", region);
        }

        return result;
    }

    public async Task InvalidateAsync(params string[] regions)
    {
        foreach (var region in regions.Distinct(StringComparer.Ordinal))
        {
            try
            {
                await distributedCache.SetStringAsync(
                    BuildVersionKey(region),
                    Guid.NewGuid().ToString("N"),
                    new DistributedCacheEntryOptions());
            }
            catch (RedisException ex)
            {
                logger.LogWarning(ex, "Redis invalidation failed for cache region {Region}", region);
            }
        }
    }

    private async Task<string?> TryGetVersionAsync(string region, CancellationToken cancellationToken)
    {
        try
        {
            return await distributedCache.GetStringAsync(BuildVersionKey(region), cancellationToken)
                ?? DefaultVersion;
        }
        catch (RedisException ex)
        {
            logger.LogWarning(ex, "Redis version lookup failed for cache region {Region}; loading from source", region);
            return null;
        }
    }

    private string BuildVersionKey(string region) => $"{_keyPrefix}:version:{region}";

    private string BuildEntryKey(string region, string version, string key)
    {
        var keyHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key)));
        return $"{_keyPrefix}:{region}:{version}:{keyHash}";
    }
}
