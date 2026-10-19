namespace server.Tests;

// Every test class that boots MfaWebFactory (a full host + SQLite) shares
// this collection so host builds serialize — parallel factories raced the
// shared host-build path and intermittently failed at EnsureSchema.
[CollectionDefinition(Name)]
public sealed class WebFactoryCollection : ICollectionFixture<object>
{
    public const string Name = "WebFactory";
}
