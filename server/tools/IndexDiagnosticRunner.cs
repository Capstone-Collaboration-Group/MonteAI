// server/Tools/IndexDiagnosticRunner.cs
//
// READ-ONLY index inventory — run INSTEAD of the web host (see Program.cs):
//
//   dotnet run --project server -- --diagnose-index
//
// Answers "why does chat say 'No relevant theses were found?'" with ground
// truth instead of guesses:
//   1. Pinecone inventory — vector counts per namespace
//      (__default__ + legacy full-text-chunks), broken down by id kind
//      (thesis_*_meta vs legacy thesis_*_chunk_* vs other). Tells us whether
//      the one-off purge ran and how many theses have a metadata vector.
//   2. Metadata field audit — pulls EVERY metadata vector (via a topK-wide
//      query) and reports which metadata keys each carries (abstract/title/
//      authors/publication_year/knowledge), because retrieval DROPS matches
//      whose "abstract" field is missing/empty.
//   3. SQL inventory — Theses grouped by Status, so the number of
//      Approved/Indexed rows can be compared with the _meta vector count
//      (rows without a vector are invisible to chat until re-ingested).
//   4. Sample query scoreboards — embeds the given queries (default: three
//      representative questions) and prints the RAW top-10 scores with no
//      threshold, then shows how many clear the live ScoreThreshold. If raw
//      scores sit just under the threshold, the threshold — not empty index
//      — is why chat returns nothing.
//
// Nothing is written: only List / Query / SELECT are used.

using System.ClientModel;
using System.ClientModel.Primitives;
using System.Data;
using System.Text;
using Azure.AI.OpenAI;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Google.Apis.Auth.OAuth2;
using Google.Cloud.Firestore;
using OpenAI;
using OpenAI.Embeddings;
using Pinecone;
using server.Configuration;

namespace server.Tools
{
    public static class IndexDiagnosticRunner
    {
        private const string DefaultNamespace = "__default__";
        private const string LegacyBodyNamespace = "full-text-chunks";

        public static async Task<int> RunAsync(string[] args)
        {
            var appsettingsPath = FindDevelopmentSettings();
            Console.WriteLine($"Config: {appsettingsPath}");

            // Layer exactly like the host: base appsettings.json first, then
            // Development overrides — otherwise the ScoreThreshold shown here
            // diverges from what the running server actually applies.
            var config = new ConfigurationBuilder()
                .AddJsonFile(Path.Combine(Path.GetDirectoryName(appsettingsPath)!, "appsettings.json"), optional: false)
                .AddJsonFile(appsettingsPath, optional: false)
                .Build();

            var pineconeConfig = new PineconeConfig();
            config.GetSection(PineconeConfig.SectionName).Bind(pineconeConfig);
            if (string.IsNullOrWhiteSpace(pineconeConfig.ApiKey))
            {
                Console.Error.WriteLine("FAIL: Pinecone:ApiKey missing from appsettings.Development.json.");
                return 1;
            }

            var indexName = string.IsNullOrWhiteSpace(pineconeConfig.IndexName)
                ? "research-assistant-abstracts"
                : pineconeConfig.IndexName;
            var threshold = config.GetValue<double?>("Pinecone:ScoreThreshold") ?? 0.2;
            var topK = config.GetValue<int?>("Pinecone:TopK") ?? 10;

            Console.WriteLine($"Index: {indexName} | threshold: {threshold} | topK: {topK}");
            Console.WriteLine();

            try
            {
                var pinecone = new PineconeClient(pineconeConfig.ApiKey);
                var index = pinecone.Index(indexName);

                // ── 1. Namespace inventory ──
                var defaultIds = await ListAllIdsAsync(index, DefaultNamespace);
                var legacyIds = await ListAllIdsAsync(index, LegacyBodyNamespace);

                var metaIds = defaultIds.Where(id => id.EndsWith("_meta", StringComparison.Ordinal)).ToList();
                var chunkIds = defaultIds.Where(id => id.Contains("_chunk_", StringComparison.Ordinal)).ToList();
                var otherIds = defaultIds.Except(metaIds).Except(chunkIds).ToList();

                Console.WriteLine("── 1. Pinecone inventory ──────────────────────────────");
                Console.WriteLine($"Namespace '{DefaultNamespace}': {defaultIds.Count} vectors");
                Console.WriteLine($"  thesis_*_meta  : {metaIds.Count}   (one per re-ingested thesis — what chat queries)");
                Console.WriteLine($"  thesis_*_chunk : {chunkIds.Count}   (legacy — should be 0 after purge)");
                Console.WriteLine($"  other          : {otherIds.Count}");
                Console.WriteLine($"Namespace '{LegacyBodyNamespace}': {legacyIds.Count} vectors (purge removes these)");
                if (chunkIds.Count > 0 || legacyIds.Count > 0)
                    Console.WriteLine("  ⚠ purge (--purge-fulltext) has NOT been fully run.");
                Console.WriteLine();

                // ── 2. Metadata field audit (every _meta vector) ──
                Console.WriteLine("── 2. Metadata vector audit ───────────────────────────");
                var audit = await AuditMetadataAsync(config, index, metaIds, threshold);
                Console.WriteLine();

                // ── 2b. Firestore abstract store (source of the abstract) ──
                Console.WriteLine("── 2b. Firestore abstract store ──────────────────────");
                await AuditFirestoreAbstractsAsync(config, metaIds);
                Console.WriteLine();

                // ── 3. SQL status counts ──
                Console.WriteLine("── 3. SQL Theses by status ────────────────────────────");
                var statusRows = await GetStatusCountsAsync(config);
                foreach (var (status, count) in statusRows)
                    Console.WriteLine($"  {status ?? "(null)"}: {count}");
                var indexedCount = statusRows
                    .Where(r => r.Status is "Indexed" or "Approved")
                    .Sum(r => r.Count);
                Console.WriteLine($"  → {indexedCount} Approved/Indexed rows vs {metaIds.Count} metadata vectors");
                if (indexedCount > metaIds.Count)
                    Console.WriteLine("  ⚠ rows WITHOUT a metadata vector are invisible to chat — re-approve/reindex them (desktop).");
                Console.WriteLine();
                await PrintThesisRowsAsync(config);
                Console.WriteLine();

                // ── 4. Sample query scoreboards ──
                Console.WriteLine("── 4. Sample queries (raw top scores, no threshold) ───");
                var queries = args.SkipWhile(a => !a.Equals("--diagnose-index", StringComparison.OrdinalIgnoreCase))
                    .Skip(1)
                    .Where(a => !a.StartsWith("--", StringComparison.Ordinal))
                    .ToList();
                if (queries.Count == 0)
                {
                    queries =
                    [
                        "Can you look for studies that employed convenience sampling?",
                        "Can you look for studies that states using some sampling method?",
                        "Can you look for studies published in CdM",
                    ];
                }

                foreach (var query in queries)
                {
                    await RunQueryAsync(config, index, query, topK, threshold);
                    Console.WriteLine();
                }

                Console.WriteLine("Diagnostic complete (read-only).");
                return 0;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"FAIL: {ex.GetType().Name}: {ex.Message}");
                return 1;
            }
        }

        // ────────────────────────── inventory helpers ──────────────────────────

        private static async Task<List<string>> ListAllIdsAsync(IndexClient index, string ns)
        {
            var ids = new List<string>();
            string? paginationToken = null;

            do
            {
                var request = new ListRequest { Limit = 100, Namespace = ns };
                if (!string.IsNullOrEmpty(paginationToken)) request.PaginationToken = paginationToken;

                var response = await index.ListAsync(request);
                var vectors = response?.Vectors;
                if (vectors is null || !vectors.Any()) break;

                ids.AddRange(vectors.Select(v => v.Id).Where(id => !string.IsNullOrEmpty(id))!);
                paginationToken = response.Pagination?.Next;
            } while (!string.IsNullOrEmpty(paginationToken));

            return ids;
        }

        private static async Task<(string? Status, int Count)[]> GetStatusCountsAsync(IConfiguration config)
        {
            var connectionString = config.GetConnectionString("DefaultConnection");
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                Console.Error.WriteLine("WARN: ConnectionStrings:DefaultConnection missing — SQL inventory skipped.");
                return [];
            }

            var rows = new List<(string? Status, int Count)>();
            await using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync();

            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT Status, COUNT(*) FROM Theses GROUP BY Status ORDER BY Status";
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                rows.Add((reader.IsDBNull(0) ? null : reader.GetString(0), reader.GetInt32(1)));
            }

            return [.. rows];
        }

        /// <summary>
        /// Per-thesis check of the Firestore "thesis_abstracts" store — the
        /// ONLY place a student/admin-entered abstract lives (the SQL Abstract
        /// column holds this document's id). A missing doc/map/entry is exactly
        /// why ingest embeds "(abstract not yet available)" and the UI shows
        /// no abstract.
        /// </summary>
        private static async Task AuditFirestoreAbstractsAsync(IConfiguration config, List<string> metaIds)
        {
            var keyPath = config["Firebase:AdminKeyPath"];
            var projectId = config["Firebase:ProjectId"];
            if (string.IsNullOrWhiteSpace(keyPath) || !File.Exists(keyPath))
            {
                Console.WriteLine($"  WARN: Firebase:AdminKeyPath not found ({keyPath ?? "(unset)"}) — Firestore check skipped.");
                return;
            }
            if (string.IsNullOrWhiteSpace(projectId))
            {
                Console.WriteLine("  WARN: Firebase:ProjectId missing — Firestore check skipped.");
                return;
            }

            var credential = GoogleCredential.FromFile(keyPath);
            var firestore = new FirestoreDbBuilder { ProjectId = projectId, Credential = credential }.Build();

            foreach (var metaId in metaIds)
            {
                // Vector id shape: thesis_{guid}_meta
                var raw = metaId.StartsWith("thesis_", StringComparison.Ordinal) ? metaId["thesis_".Length..] : metaId;
                if (raw.EndsWith("_meta", StringComparison.Ordinal)) raw = raw[..^"_meta".Length];
                if (!Guid.TryParse(raw, out var thesisId))
                {
                    Console.WriteLine($"  {metaId}: cannot parse thesis Guid from vector id.");
                    continue;
                }

                DocumentSnapshot snapshot;
                try
                {
                    snapshot = await firestore.Collection("thesis_abstracts").Document(thesisId.ToString()).GetSnapshotAsync();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"  {thesisId}: Firestore read FAILED ({ex.GetType().Name}: {ex.Message})");
                    continue;
                }

                if (!snapshot.Exists)
                {
                    Console.WriteLine($"  {thesisId}: DOC MISSING  ← ingest embeds the placeholder; UI shows no abstract");
                    continue;
                }
                if (!snapshot.ContainsField("abstracts"))
                {
                    // Dump the real field names — the writer may have created a
                    // literal dotted key ("abstracts.1") instead of a nested map.
                    var names = string.Join(", ", snapshot.ToDictionary().Keys);
                    Console.WriteLine($"  {thesisId}: doc exists but 'abstracts' map MISSING  ← placeholder embedded");
                    Console.WriteLine($"    fields present: [{names}]");
                    continue;
                }

                var map = snapshot.GetValue<Dictionary<string, object>>("abstracts");
                string? latest = null;
                var best = int.MinValue;
                foreach (var entry in map)
                {
                    if (int.TryParse(entry.Key, out var v) && v > best)
                    {
                        best = v;
                        latest = entry.Value?.ToString();
                    }
                }

                if (string.IsNullOrWhiteSpace(latest))
                    Console.WriteLine($"  {thesisId}: abstracts map EMPTY (latest v{best})  ← placeholder embedded");
                else
                    Console.WriteLine($"  {thesisId}: OK — version {best}, {latest.Length} chars | {Truncate(latest.Replace("\n", " "), 80)}");
            }
        }

        /// <summary>
        /// One row per thesis: status plus the SHAPE of the SQL Abstract
        /// column (GUID → Firestore doc id, raw text → legacy fallback,
        /// NULL → never set). Explains what the API layer will resolve.
        /// </summary>
        private static async Task PrintThesisRowsAsync(IConfiguration config)
        {
            var connectionString = config.GetConnectionString("DefaultConnection");
            if (string.IsNullOrWhiteSpace(connectionString)) return;

            await using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync();

            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT Id, Status, Abstract, LEFT(Title, 50) FROM Theses ORDER BY SubmittedAt DESC";
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var id = reader.GetGuid(0);
                var status = reader.IsDBNull(1) ? "(null)" : reader.GetString(1);
                var abs = reader.IsDBNull(2) ? null : reader.GetString(2);
                var shape = abs is null
                    ? "(NULL)"
                    : Guid.TryParse(abs, out _)
                        ? "GUID → Firestore"
                        : $"raw text: \"{Truncate(abs.Replace("\n", " "), 40)}\"";
                var title = reader.IsDBNull(3) ? "" : reader.GetString(3);
                Console.WriteLine($"  {id} | {status,-8} | abstract={shape} | {title}");
            }
        }

        // ────────────────────────── metadata audit ──────────────────────────

        /// <summary>
        /// Pulls every metadata vector with a topK-wide query against a REAL
        /// embedding (so Pinecone returns all of them with their metadata) and
        /// reports which fields each carries. Similarity scores here are only
        /// used to reveal the score distribution for the probe query.
        /// </summary>
        private static async Task<List<(string Id, float Score, Dictionary<string, string> Fields)>> AuditMetadataAsync(
            IConfiguration config,
            IndexClient index,
            List<string> metaIds,
            double threshold)
        {
            var results = new List<(string Id, float Score, Dictionary<string, string> Fields)>();
            if (metaIds.Count == 0)
            {
                Console.WriteLine("  No thesis_*_meta vectors — chat can NEVER find anything until theses are re-ingested.");
                return results;
            }

            var probe = await EmbedAsync(config, "sample thesis metadata audit probe");
            var response = await index.QueryAsync(new QueryRequest
            {
                Vector = probe,
                TopK = (uint)Math.Min(metaIds.Count, 100),
                IncludeMetadata = true,
                Namespace = DefaultNamespace,
            });

            foreach (var match in response?.Matches ?? [])
            {
                var id = match.Id ?? "(no id)";
                var score = match.Score ?? 0f;
                var fields = new Dictionary<string, string>();
                var metadata = match.Metadata;
                if (metadata is not null)
                {
                    foreach (var key in metadata.Keys)
                    {
                        var value = metadata[key];
                        fields[key] = value?.ToString() ?? "(null)";
                    }
                }

                var abstractText = fields.TryGetValue("abstract", out var abs) ? abs : null;
                var title = fields.TryGetValue("title", out var t) ? t : null;
                var year = fields.TryGetValue("publication_year", out var y) ? y : null;
                var kind = fields.TryGetValue("kind", out var k) ? k : "(missing)";
                // metadata["abstract"] is the FULL vector body (title/author/
                // year header + "Abstract: ..."), so a placeholder abstract
                // hides inside it — check the body, not an exact match.
                var isPlaceholder = abstractText is not null &&
                    abstractText.Contains("(abstract not yet available)", StringComparison.Ordinal);
                var absInfo = abstractText is null
                    ? "abstract=MISSING  ← retrieval DROPS this vector"
                    : isPlaceholder
                        ? "abstract=PLACEHOLDER  ← '(abstract not yet available)' inside the body"
                        : $"abstract={abstractText.Length} chars";
                var preview = abstractText is null ? "" : Truncate(abstractText.Replace("\n", " ⏎ "), 110);

                Console.WriteLine($"  {id}");
                Console.WriteLine($"    {absInfo} | kind={kind} | year={(year ?? "-")} | title={(title is null ? "(missing)" : Truncate(title, 60))}");
                Console.WriteLine($"    preview: {preview}");
                if (abstractText is { Length: > 400 })
                {
                    Console.WriteLine($"    tail:    …{Truncate(abstractText[^Math.Min(300, abstractText.Length)..].Replace("\n", " ⏎ "), 300)}");
                }
                results.Add((id, score, fields));
            }

            var missingAbstract = results.Count(r => !r.Fields.ContainsKey("abstract") || string.IsNullOrWhiteSpace(r.Fields["abstract"]));
            if (missingAbstract > 0)
                Console.WriteLine($"  ⚠ {missingAbstract}/{results.Count} vectors have no usable abstract field.");
            return results;
        }

        // ────────────────────────── sample queries ──────────────────────────

        private static async Task RunQueryAsync(
            IConfiguration config,
            IndexClient index,
            string query,
            int topK,
            double threshold)
        {
            Console.WriteLine($"Q: {query}");
            var vector = await EmbedAsync(config, query);
            var response = await index.QueryAsync(new QueryRequest
            {
                Vector = vector,
                TopK = (uint)Math.Clamp(topK, 1, 50),
                IncludeMetadata = true,
                Namespace = DefaultNamespace,
            });

            var matches = response?.Matches ?? [];
            if (!matches.Any())
            {
                Console.WriteLine("  (no matches at all — namespace empty?)");
                return;
            }

            var kept = 0;
            var rank = 0;
            foreach (var match in matches)
            {
                rank++;
                var score = match.Score ?? 0f;
                var pass = score >= threshold;
                if (pass) kept++;
                var metadata = match.Metadata;
                var title = metadata is not null && metadata.TryGetValue("title", out var t) ? t.ToString() : null;
                var hasAbstract = metadata is not null && metadata.TryGetValue("abstract", out var a) && !string.IsNullOrWhiteSpace(a?.ToString());
                Console.WriteLine(
                    $"  #{rank} score={score:0.000} {(pass ? "PASS" : "fail")} | {(hasAbstract ? "abs" : "NO-ABS")} | {Truncate(title ?? match.Id ?? "?", 70)}");
            }

            Console.WriteLine($"  → {kept}/{matches.Count()} clear the {threshold} threshold → chat would see {kept} source(s)");
            if (kept == 0)
                Console.WriteLine("  ⚠ score-threshold filter returns NOTHING for this query.");
        }

        private static async Task<float[]> EmbedAsync(IConfiguration config, string text)
        {
            var endpoint = config["AzureAIEmbedding:Endpoint"];
            var deployment = config["AzureAIEmbedding:EmbeddingDeploymentName"];
            var apiKey = config["AzureAIEmbedding:ApiKey"];
            if (string.IsNullOrWhiteSpace(endpoint) || string.IsNullOrWhiteSpace(deployment) || string.IsNullOrWhiteSpace(apiKey))
                throw new InvalidOperationException("AzureAIEmbedding:Endpoint/EmbeddingDeploymentName/ApiKey must be set.");

            var options = new AzureOpenAIClientOptions(AzureOpenAIClientOptions.ServiceVersion.V2024_06_01)
            {
                NetworkTimeout = TimeSpan.FromSeconds(20),
                RetryPolicy = new ClientRetryPolicy(maxRetries: 1),
            };
            var azureClient = new AzureOpenAIClient(new Uri(endpoint), new ApiKeyCredential(apiKey), options);
            var embeddingClient = azureClient.GetEmbeddingClient(deployment);

            var result = await embeddingClient.GenerateEmbeddingAsync(text);
            return result.Value.ToFloats().ToArray();
        }

        private static string Truncate(string value, int max)
            => value.Length <= max ? value : value[..max] + "…";

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
