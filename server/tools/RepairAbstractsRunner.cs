// server/Tools/RepairAbstractsRunner.cs
//
// One-off DATA REPAIR — run INSTEAD of the web host (see Program.cs):
//
//   dotnet run --project server -- --repair-abstracts
//
// The dotted-key bug: SetAsync with the dictionary key "abstracts.<n>" was
// stored by this SDK version as a LITERAL top-level field named
// "abstracts.1", not as the nested {"abstracts": {"1": text}} map every
// reader expects. Result: abstracts invisible everywhere (UI nulls, ingest
// embeds "(abstract not yet available)").
//
// For every doc in "thesis_abstracts" that still has literal "abstracts.<n>"
// fields: merge those entries into the nested map (versions already present
// in the nested map win) and delete the literal fields. Idempotent — docs
// without literal fields are untouched.
//
// WRITES Firestore. Run it, then `dotnet run --project server -- --reingest-all`
// to rebuild the metadata vectors with the recovered abstracts.

using Google.Apis.Auth.OAuth2;
using Google.Cloud.Firestore;
using Microsoft.Extensions.Configuration;

namespace server.Tools
{
    public static class RepairAbstractsRunner
    {
        private const string CollectionName = "thesis_abstracts";
        private const string AbstractsField = "abstracts";
        private const string LiteralPrefix = AbstractsField + ".";

        public static async Task<int> RunAsync(string[] args)
        {
            _ = args;

            var appsettingsPath = FindDevelopmentSettings();
            var config = new ConfigurationBuilder()
                .AddJsonFile(Path.Combine(Path.GetDirectoryName(appsettingsPath)!, "appsettings.json"), optional: false)
                .AddJsonFile(appsettingsPath, optional: false)
                .Build();

            var keyPath = config["Firebase:AdminKeyPath"];
            var projectId = config["Firebase:ProjectId"];
            if (string.IsNullOrWhiteSpace(keyPath) || !File.Exists(keyPath))
            {
                Console.Error.WriteLine($"FAIL: Firebase:AdminKeyPath not found ({keyPath ?? "(unset)"}).");
                return 1;
            }
            if (string.IsNullOrWhiteSpace(projectId))
            {
                Console.Error.WriteLine("FAIL: Firebase:ProjectId missing.");
                return 1;
            }

            var firestore = new FirestoreDbBuilder
            {
                ProjectId = projectId,
                Credential = GoogleCredential.FromFile(keyPath)
            }.Build();

            var repaired = 0;
            var clean = 0;
            var errors = 0;

            await foreach (var docRef in firestore.Collection(CollectionName).ListDocumentsAsync())
            {
                DocumentSnapshot snapshot;
                try
                {
                    snapshot = await docRef.GetSnapshotAsync();
                }
                catch (Exception ex)
                {
                    errors++;
                    Console.WriteLine($"  FAIL {docRef.Id} (read: {ex.GetType().Name}: {ex.Message})");
                    continue;
                }

                var literals = new Dictionary<int, string>();
                foreach (var field in snapshot.ToDictionary())
                {
                    if (!field.Key.StartsWith(LiteralPrefix, StringComparison.Ordinal)) continue;
                    if (!int.TryParse(field.Key[LiteralPrefix.Length..], out var version)) continue;
                    literals[version] = field.Value?.ToString() ?? string.Empty;
                }

                if (literals.Count == 0)
                {
                    clean++;
                    continue;
                }

                try
                {
                    // Versions already in the nested map are NEWER edits —
                    // keep them; only pull the orphaned literal values in.
                    var existing = new HashSet<int>();
                    if (snapshot.ContainsField(AbstractsField))
                    {
                        try
                        {
                            var map = snapshot.GetValue<Dictionary<string, object>>(AbstractsField);
                            foreach (var entry in map)
                                if (int.TryParse(entry.Key, out var v))
                                    existing.Add(v);
                        }
                        catch (Exception)
                        {
                            // Wrong type on the field — treat as empty map.
                        }
                    }

                    var missing = literals
                        .Where(kv => !existing.Contains(kv.Key))
                        .ToList();

                    if (missing.Count > 0)
                    {
                        var nested = new Dictionary<string, object>();
                        foreach (var (version, text) in missing)
                            nested[version.ToString()] = text;

                        await docRef.SetAsync(
                            new Dictionary<string, object> { [AbstractsField] = nested },
                            SetOptions.MergeAll);
                    }

                    foreach (var version in literals.Keys)
                    {
                        // FieldPath takes the dotted name as ONE literal
                        // segment — the string-key overload would split it
                        // into a nested path that matches nothing.
                        await docRef.UpdateAsync(new Dictionary<FieldPath, object>
                        {
                            [new FieldPath(LiteralPrefix + version)] = FieldValue.Delete
                        });
                    }

                    repaired++;
                    Console.WriteLine(
                        $"  OK   {docRef.Id}: moved {literals.Count} literal entr{(literals.Count == 1 ? "y" : "ies")} into the nested map" +
                        (missing.Count < literals.Count ? $" ({literals.Count - missing.Count} kept from existing map)" : "") +
                        $" | versions: {string.Join(", ", literals.Keys.OrderBy(v => v))}");
                }
                catch (Exception ex)
                {
                    errors++;
                    Console.WriteLine($"  FAIL {docRef.Id} ({ex.GetType().Name}: {ex.Message})");
                }
            }

            Console.WriteLine();
            Console.WriteLine($"Done: {repaired} repaired, {clean} already clean, {errors} failed.");
            if (repaired > 0)
                Console.WriteLine("Next: dotnet run --project server -- --reingest-all  (rebuild vectors with the recovered abstracts)");
            return errors == 0 ? 0 : 1;
        }

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
