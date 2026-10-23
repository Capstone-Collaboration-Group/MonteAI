// server/Tools/FullTextPurgeRunner.cs
//
// One-off cleanup for the full-text ingestion feature removal — run INSTEAD
// of the web host (see Program.cs):
//
//   dotnet run --project server -- --purge-fulltext
//
// What it does (idempotent, safe to re-run):
//   1. Flushes the legacy "full-text-chunks" Pinecone namespace entirely
//      (paginated list + batch delete — the namespace held only body chunks).
//   2. In the default namespace, deletes any remaining legacy body vectors
//      (ids matching thesis_*_chunk_*) while KEEPING metadata vectors
//      (thesis_*_meta).
//   3. Reads Theses.IngestStagingUrl via raw SQL (the column may still exist
//      — run this BEFORE `dotnet ef database update` applies the
//      RemoveIngestStagingUrl migration) and deletes each lingering ingest
//      staging blob from Azure Blob Storage.
//
// Exit code 0 = purge completed; 1 = fatal error. Requires the same
// gitignored appsettings.Development.json as the server (Pinecone key,
// AzureStorage connection string, DefaultConnection).

using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Pinecone;
using server.Configuration;
using server.Services;
using server.Services.Interfaces;
using PineconeIndex = Pinecone.IndexClient;

namespace server.Tools
{
    public static class FullTextPurgeRunner
    {
        /// <summary>The pre-metadata-only namespace that held full-text body chunks.</summary>
        private const string LegacyBodyNamespace = "full-text-chunks";

        /// <summary>Namespace holding the one-per-thesis metadata vectors (kept).</summary>
        private const string MetadataNamespace = "__default__";

        /// <summary>Runs the purge; returns the process exit code.</summary>
        public static async Task<int> RunAsync(string[] args)
        {
            _ = args;

            var appsettingsPath = FindDevelopmentSettings();
            Console.WriteLine($"Config: {appsettingsPath}");

            var config = new ConfigurationBuilder()
                .AddJsonFile(appsettingsPath, optional: false)
                .Build();

            var pineconeConfig = new PineconeConfig();
            config.GetSection(PineconeConfig.SectionName).Bind(pineconeConfig);
            if (string.IsNullOrWhiteSpace(pineconeConfig.ApiKey))
            {
                Console.Error.WriteLine("FAIL: Pinecone:ApiKey is missing from appsettings.Development.json.");
                return 1;
            }

            var indexName = string.IsNullOrWhiteSpace(pineconeConfig.IndexName)
                ? "research-assistant-abstracts"
                : pineconeConfig.IndexName;
            Console.WriteLine($"Index: {indexName}");

            var pinecone = new PineconeClient(pineconeConfig.ApiKey);
            var index = pinecone.Index(indexName);

            try
            {
                // 1. Flush the legacy body namespace.
                var flushed = await FlushNamespaceAsync(index, LegacyBodyNamespace);
                Console.WriteLine($"Namespace '{LegacyBodyNamespace}': {flushed} vectors deleted.");

                // 2. Legacy body vectors left in the default namespace.
                var legacyBody = await DeleteLegacyBodyChunksAsync(index, MetadataNamespace);
                Console.WriteLine($"Namespace '{MetadataNamespace}': {legacyBody} legacy body chunk(s) deleted (metadata vectors kept).");

                // 3. Staging blobs referenced by Theses.IngestStagingUrl.
                var (blobs, blobErrors) = await PurgeStagingBlobsAsync(config);
                Console.WriteLine($"Staging blobs: {blobs} deleted, {blobErrors} error(s).");
                if (blobErrors > 0)
                {
                    Console.Error.WriteLine("WARN: some staging blobs could not be deleted — check the logs above.");
                }

                Console.WriteLine("Purge complete.");
                return 0;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"FAIL: {ex.GetType().Name}: {ex.Message}");
                return 1;
            }
        }

        /// <summary>Lists and deletes EVERY vector in a namespace (paginated, 100 ids per delete).</summary>
        private static async Task<int> FlushNamespaceAsync(PineconeIndex index, string ns)
        {
            var total = 0;
            string? paginationToken = null;

            do
            {
                var listRequest = new ListRequest { Limit = 100, Namespace = ns };
                if (!string.IsNullOrEmpty(paginationToken)) listRequest.PaginationToken = paginationToken;

                var listResponse = await index.ListAsync(listRequest);
                var vectors = listResponse?.Vectors;
                if (vectors is null || !vectors.Any()) break;

                var ids = vectors
                    .Select(v => v.Id)
                    .Where(id => !string.IsNullOrEmpty(id))
                    .ToList();

                if (ids.Count > 0)
                {
                    await index.DeleteAsync(new DeleteRequest { Namespace = ns, Ids = ids });
                    total += ids.Count;
                    Console.WriteLine($"  deleted {ids.Count} (running total {total})");
                }

                paginationToken = listResponse.Pagination?.Next;
            } while (!string.IsNullOrEmpty(paginationToken));

            return total;
        }

        /// <summary>
        /// Deletes ids matching thesis_*_chunk_* in the given namespace —
        /// legacy full-text vectors. thesis_*_meta (the metadata vectors) are
        /// untouched.
        /// </summary>
        private static async Task<int> DeleteLegacyBodyChunksAsync(PineconeIndex index, string ns)
        {
            var total = 0;
            string? paginationToken = null;

            do
            {
                var listRequest = new ListRequest { Prefix = "thesis_", Limit = 100, Namespace = ns };
                if (!string.IsNullOrEmpty(paginationToken)) listRequest.PaginationToken = paginationToken;

                var listResponse = await index.ListAsync(listRequest);
                var vectors = listResponse?.Vectors;
                if (vectors is null || !vectors.Any()) break;

                var ids = vectors
                    .Select(v => v.Id)
                    .Where(id => !string.IsNullOrEmpty(id) && id.Contains("_chunk_", StringComparison.Ordinal))
                    .ToList();

                if (ids.Count > 0)
                {
                    await index.DeleteAsync(new DeleteRequest { Namespace = ns, Ids = ids });
                    total += ids.Count;
                    Console.WriteLine($"  deleted {ids.Count} legacy body chunk(s) (running total {total})");
                }

                paginationToken = listResponse.Pagination?.Next;
            } while (!string.IsNullOrEmpty(paginationToken));

            return total;
        }

        /// <summary>
        /// Deletes the staging blob of every thesis whose IngestStagingUrl is
        /// non-null, via raw SQL (the EF entity no longer maps the column).
        /// Returns (deletedCount, errorCount).
        /// </summary>
        private static async Task<(int Deleted, int Errors)> PurgeStagingBlobsAsync(IConfiguration config)
        {
            var connectionString = config.GetConnectionString("DefaultConnection");
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                Console.Error.WriteLine("WARN: ConnectionStrings:DefaultConnection missing — staging blob purge skipped.");
                return (0, 1);
            }

            IBlobService blobService;
            try
            {
                blobService = new BlobService(config, logger: NullLogger<BlobService>.Instance);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"WARN: blob service init failed ({ex.Message}) — staging blob purge skipped.");
                return (0, 1);
            }

            var deleted = 0;
            var errors = 0;

            await using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync();

            // The column is dropped once RemoveIngestStagingUrl has been
            // applied — re-running the purge after the migration must NOT
            // crash, it just reports there is nothing left to clean.
            await using (var columnCheck = connection.CreateCommand())
            {
                columnCheck.CommandText =
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS " +
                    "WHERE TABLE_NAME = 'Theses' AND COLUMN_NAME = 'IngestStagingUrl'";
                var columnExists = Convert.ToInt32(await columnCheck.ExecuteScalarAsync()) > 0;
                if (!columnExists)
                {
                    Console.WriteLine("  IngestStagingUrl column already dropped (migration applied) — staging blob purge skipped.");
                    return (0, 0);
                }
            }

            // The column still exists when this runs BEFORE the
            // RemoveIngestStagingUrl migration — that is the documented order.
            await using (var command = connection.CreateCommand())
            {
                command.CommandText =
                    "SELECT Id, IngestStagingUrl FROM Theses WHERE IngestStagingUrl IS NOT NULL";
                await using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var id = reader.GetGuid(0);
                    var stagingUrl = reader.GetString(1);
                    try
                    {
                        await blobService.DeleteAsync(stagingUrl);
                        deleted++;
                        Console.WriteLine($"  staging blob deleted for thesis {id}");
                    }
                    catch (Exception ex)
                    {
                        errors++;
                        Console.Error.WriteLine($"  staging blob delete FAILED for thesis {id}: {ex.Message}");
                    }
                }
            }

            // Clear the pointers so a later re-run (or the migration itself)
            // never revisits dead URLs.
            if (deleted + errors > 0)
            {
                await using var clear = connection.CreateCommand();
                clear.CommandText = "UPDATE Theses SET IngestStagingUrl = NULL WHERE IngestStagingUrl IS NOT NULL";
                var cleared = await clear.ExecuteNonQueryAsync();
                Console.WriteLine($"  IngestStagingUrl cleared on {cleared} row(s).");
            }

            return (deleted, errors);
        }

        /// <summary>Walks up from the binary to the server/ folder containing appsettings.Development.json.</summary>
        private static string FindDevelopmentSettings()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir is not null)
            {
                var candidate = Path.Combine(dir.FullName, "appsettings.Development.json");
                if (File.Exists(candidate) && File.Exists(Path.Combine(dir.FullName, "server.csproj")))
                {
                    return candidate;
                }
                dir = dir.Parent;
            }

            throw new FileNotFoundException(
                "Could not locate server/appsettings.Development.json above " + AppContext.BaseDirectory);
        }
    }
}
