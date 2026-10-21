using System.ComponentModel;
using System.Diagnostics;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using Google.Cloud.Firestore;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.DTOs.Backup;
using server.Services.Interfaces;

namespace server.Services
{
    // Full-copy backup engine for the desktop Backup page (Route B):
    //
    //   database   — JSON dump of all 14 SQL tables (secrets excluded)
    //   bacpac     — restorable SQL snapshot via sqlpackage (optional host tool)
    //   thesis-files — PDFs; desktop pulls them via container SAS, server copies
    //                  them itself in the scheduled run
    //   firestore  — annotations, versioned abstracts, chat messages
    //
    // Two delivery paths share this engine: the controller streams a zip built
    // on disk, the scheduler (BackupScheduler) writes the same zip plus loose
    // PDFs into the configured output folder.
    public class BackupService : IBackupService
    {
        public const string DatabaseKey = "database";
        public const string BacpacKey = "bacpac";
        public const string ThesisFilesKey = "thesis-files";
        public const string FirestoreKey = "firestore";

        private static readonly string[] AllKeys = [DatabaseKey, BacpacKey, ThesisFilesKey, FirestoreKey];

        private const string ManifestNote =
            "Inventory manifest for the paired backup artifacts (data zip / PDF folder from " +
            "the same run). Lists what exists in the live system — the data files hold the " +
            "actual copy. TOTP secrets and recovery-code hashes are never exported.";

        private static readonly string[] ReadmeLines =
        [
            "MonteAI backup set",
            "==================",
            "",
            "Files:",
            "  manifest.json   — inventory of what this backup covers (counts, file list)",
            "  database.json   — every SQL table as JSON (camelCase, secrets excluded)",
            "  firestore.json  — annotations, versioned abstracts, chat messages (path + fields)",
            "  database.bacpac — restorable SQL snapshot (when selected)",
            "  files/          — thesis PDFs copied from Azure Blob (scheduled runs)",
            "",
            "Restore:",
            "  1. .bacpac: SSMS > Restore > Database > From bacpac, or",
            "     sqlpackage /Action:Import /TargetConnectionString:\"...\" /SourceFile:database.bacpac",
            "  2. database.json (no bacpac): load tables via scripts — keep foreign-key order",
            "     (students/admins before research_groups, theses before submissions/reviews, ...).",
            "  3. firestore.json: re-create documents at their stored \"path\" (field maps).",
            "  4. files/: upload back to the Azure Blob thesis container.",
            "  5. Pinecone is never backed up — re-run thesis ingestion to rebuild vectors",
            "     (desktop approve pipeline or POST /thesis/ingest/full).",
        ];

        // Web defaults (camelCase) + cycle-safe navigation handling + hard
        // exclusion of auth secrets — the dump must never carry them.
        private static readonly JsonSerializerOptions ExportJsonOptions = CreateExportJsonOptions();

        private readonly AppDbContext _db;
        private readonly IBlobService _blobs;
        private readonly FirestoreDb _firestore;
        private readonly IConfiguration _config;
        private readonly ILogger<BackupService> _logger;

        public BackupService(
            AppDbContext db,
            IBlobService blobs,
            FirestoreDb firestore,
            IConfiguration config,
            ILogger<BackupService> logger)
        {
            _db = db;
            _blobs = blobs;
            _firestore = firestore;
            _config = config;
            _logger = logger;
        }

        public async Task<BackupStatsDto> GetStatsAsync(CancellationToken cancellationToken = default)
        {
            var snapshot = await TakeSnapshotAsync(cancellationToken);
            return ToStats(snapshot);
        }

        public async Task<BackupManifestDto> CreateManifestAsync(
            IReadOnlyCollection<string> categoryKeys,
            CancellationToken cancellationToken = default)
        {
            var normalized = NormalizeKeys(categoryKeys);
            var snapshot = await TakeSnapshotAsync(cancellationToken);

            var categories = new List<BackupManifestCategoryDto>();
            foreach (var key in AllKeys.Where(k => normalized.Contains(k)))
            {
                categories.Add(key switch
                {
                    DatabaseKey => new BackupManifestCategoryDto
                    {
                        Key = DatabaseKey,
                        Name = "Database Records (JSON)",
                        RecordCount = snapshot.DatabaseTotal,
                        SizeBytes = null,
                        Unit = "rows",
                        Counts = snapshot.DatabaseCounts,
                    },
                    BacpacKey => new BackupManifestCategoryDto
                    {
                        Key = BacpacKey,
                        Name = "Database Snapshot (.bacpac)",
                        RecordCount = null,
                        SizeBytes = null,
                        Unit = "export",
                    },
                    ThesisFilesKey => new BackupManifestCategoryDto
                    {
                        Key = ThesisFilesKey,
                        Name = "Thesis Files (PDF)",
                        RecordCount = snapshot.ThesisFiles.Count,
                        SizeBytes = snapshot.ThesisFilesSizeBytes,
                        Unit = "files",
                        ThesisFiles = snapshot.ThesisFiles,
                    },
                    FirestoreKey => new BackupManifestCategoryDto
                    {
                        Key = FirestoreKey,
                        Name = "Firestore Documents",
                        RecordCount = snapshot.FirestoreTotal,
                        SizeBytes = null,
                        Unit = "docs",
                        Counts = snapshot.FirestoreCounts,
                    },
                    _ => throw new UnreachableException(),
                });
            }

            return new BackupManifestDto
            {
                ManifestVersion = "2",
                Kind = "monteai-backup-manifest",
                CreatedAt = DateTimeOffset.UtcNow,
                Note = ManifestNote,
                Categories = categories,
            };
        }

        public async Task<BackupPdfPlanDto> GetPdfPlanAsync(CancellationToken cancellationToken = default)
        {
            var files = await _blobs.ListPdfBlobsAsync(cancellationToken);
            return new BackupPdfPlanDto
            {
                ContainerSasUrl = _blobs.GenerateContainerSasUrl(180),
                GeneratedAt = DateTimeOffset.UtcNow,
                TotalBytes = files.Sum(f => f.SizeBytes),
                Files = files
                    .Select(f => new BackupPdfFileDto { BlobName = f.BlobName, SizeBytes = f.SizeBytes })
                    .ToList(),
            };
        }

        public async Task WriteExportZipAsync(
            IReadOnlyCollection<string> categoryKeys,
            string zipFilePath,
            CancellationToken cancellationToken = default)
        {
            var keys = NormalizeKeys(categoryKeys);

            // Build every payload BEFORE touching the zip file so failures
            // (Firestore unreachable, sqlpackage missing) abort cleanly.
            Dictionary<string, object>? tables = null;
            if (keys.Contains(DatabaseKey))
                tables = await BuildDatabaseDumpAsync(cancellationToken);

            Dictionary<string, object>? firestoreDump = null;
            if (keys.Contains(FirestoreKey))
                firestoreDump = await BuildFirestoreDumpAsync(cancellationToken);

            string? tempBacpac = null;
            if (keys.Contains(BacpacKey))
            {
                tempBacpac = Path.Combine(Path.GetTempPath(), $"monteai-export-{Guid.NewGuid():N}.bacpac");
                await ExportBacpacAsync(tempBacpac, cancellationToken);
            }

            try
            {
                var manifest = await CreateManifestAsync(keys, cancellationToken);

                await using var zipStream = File.Create(zipFilePath);
                using var zip = new ZipArchive(zipStream, ZipArchiveMode.Create);

                await AddJsonEntryAsync(zip, "manifest.json", manifest, cancellationToken);

                if (tables != null)
                    await AddJsonEntryAsync(zip, "database.json",
                        new { generatedAt = DateTimeOffset.UtcNow, tables }, cancellationToken);

                if (firestoreDump != null)
                    await AddJsonEntryAsync(zip, "firestore.json",
                        new { generatedAt = DateTimeOffset.UtcNow, documents = firestoreDump }, cancellationToken);

                if (tempBacpac != null)
                {
                    var entry = zip.CreateEntry("database.bacpac", CompressionLevel.Optimal);
                    await using var entryStream = entry.Open();
                    await using var bacpacFile = File.OpenRead(tempBacpac);
                    await bacpacFile.CopyToAsync(entryStream, cancellationToken);
                }

                var readme = zip.CreateEntry("README.txt", CompressionLevel.Optimal);
                await using (var readmeStream = readme.Open())
                {
                    var bytes = Encoding.UTF8.GetBytes(string.Join(Environment.NewLine, ReadmeLines));
                    await readmeStream.WriteAsync(bytes, cancellationToken);
                }

                _logger.LogInformation(
                    "Backup zip written: {Path} ({Bytes} bytes, categories: {Categories})",
                    zipFilePath,
                    new FileInfo(zipFilePath).Length,
                    string.Join(", ", keys));
            }
            finally
            {
                if (tempBacpac != null)
                {
                    try { File.Delete(tempBacpac); }
                    catch (Exception ex) { _logger.LogWarning(ex, "Could not delete temp bacpac {Path}", tempBacpac); }
                }
            }
        }

        public async Task<BackupScheduledRunDto> WriteScheduledBackupAsync(
            string outputFolder,
            IReadOnlyCollection<string> categoryKeys,
            int keepCount,
            CancellationToken cancellationToken = default)
        {
            var keys = NormalizeKeys(categoryKeys);

            Directory.CreateDirectory(outputFolder);
            var stamp = DateTime.UtcNow.ToString("yyyy-MM-dd_HH-mm-ss");
            var folder = Path.Combine(outputFolder, $"backup_{stamp}");
            Directory.CreateDirectory(folder);

            var result = new BackupScheduledRunDto { Folder = folder, ManifestPath = string.Empty };

            if (keys.Contains(DatabaseKey) || keys.Contains(BacpacKey) || keys.Contains(FirestoreKey))
            {
                result.DataZipPath = Path.Combine(folder, "data.zip");
                await WriteExportZipAsync(keys, result.DataZipPath, cancellationToken);
            }

            if (keys.Contains(ThesisFilesKey))
            {
                result.FilesFolder = Path.Combine(folder, "files");
                Directory.CreateDirectory(result.FilesFolder);
                var files = await _blobs.ListPdfBlobsAsync(cancellationToken);
                foreach (var file in files)
                {
                    var relative = SanitizeRelativePath(file.BlobName);
                    if (relative == null)
                    {
                        _logger.LogWarning("Skipping suspicious blob name in backup: {BlobName}", file.BlobName);
                        continue;
                    }

                    var destination = Path.Combine(result.FilesFolder, relative);
                    if (File.Exists(destination) && new FileInfo(destination).Length == file.SizeBytes)
                        continue;

                    Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
                    await using var target = File.Create(destination);
                    await _blobs.CopyPdfAsync(file.BlobName, target, cancellationToken);
                    result.PdfCount++;
                    result.PdfBytes += file.SizeBytes;
                }
            }

            var manifest = await CreateManifestAsync(keys, cancellationToken);
            result.ManifestPath = Path.Combine(folder, "manifest.json");
            await File.WriteAllTextAsync(
                result.ManifestPath,
                JsonSerializer.Serialize(manifest, ExportJsonOptions),
                cancellationToken);

            PruneOldBackups(outputFolder, keepCount);
            _logger.LogInformation(
                "Scheduled backup written to {Folder} (zip: {Zip}, pdfs: {PdfCount}/{PdfBytes} bytes)",
                folder, result.DataZipPath ?? "-", result.PdfCount, result.PdfBytes);
            return result;
        }

        // ---------- payload builders ----------

        private async Task<Dictionary<string, object>> BuildDatabaseDumpAsync(CancellationToken cancellationToken)
        {
            return new Dictionary<string, object>
            {
                ["students"] = await _db.Students.AsNoTracking().ToListAsync(cancellationToken),
                ["admins"] = await _db.Admins.AsNoTracking().ToListAsync(cancellationToken),
                ["faculties"] = await _db.Faculties.AsNoTracking().ToListAsync(cancellationToken),
                ["programHeads"] = await _db.ProgramHeads.AsNoTracking().ToListAsync(cancellationToken),
                ["researchGroups"] = await _db.ResearchGroups.AsNoTracking().ToListAsync(cancellationToken),
                ["theses"] = await _db.Theses.AsNoTracking().ToListAsync(cancellationToken),
                ["thesisVersions"] = await _db.ThesisVersions.AsNoTracking().ToListAsync(cancellationToken),
                ["submissions"] = await _db.Submissions.AsNoTracking().ToListAsync(cancellationToken),
                ["reviews"] = await _db.Reviews.AsNoTracking().ToListAsync(cancellationToken),
                ["schedules"] = await _db.Schedules.AsNoTracking().ToListAsync(cancellationToken),
                ["panelistSchedules"] = await _db.PanelistSchedules.AsNoTracking().ToListAsync(cancellationToken),
                ["announcements"] = await _db.Announcements.AsNoTracking().ToListAsync(cancellationToken),
                ["notifications"] = await _db.Notifications.AsNoTracking().ToListAsync(cancellationToken),
                ["chatSessions"] = await _db.ChatSessions.AsNoTracking().ToListAsync(cancellationToken),
            };
        }

        private async Task<Dictionary<string, object>> BuildFirestoreDumpAsync(CancellationToken cancellationToken)
        {
            try
            {
                var annotations = await _firestore.CollectionGroup("annotations").GetSnapshotAsync(cancellationToken);
                var abstracts = await _firestore.Collection("thesis_abstracts").GetSnapshotAsync(cancellationToken);
                var messages = await _firestore.CollectionGroup("messages").GetSnapshotAsync(cancellationToken);

                return new Dictionary<string, object>
                {
                    ["annotations"] = annotations.Documents.Select(ToFirestoreRecord).ToList(),
                    ["abstracts"] = abstracts.Documents.Select(ToFirestoreRecord).ToList(),
                    ["chatMessages"] = messages.Documents.Select(ToFirestoreRecord).ToList(),
                };
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Firestore backup export failed");
                throw new InvalidOperationException(
                    "Firestore export failed — the backup was aborted so the archive stays complete. " +
                    $"Details: {ex.Message}");
            }
        }

        private static Dictionary<string, object> ToFirestoreRecord(DocumentSnapshot doc)
        {
            var record = new Dictionary<string, object>
            {
                ["path"] = doc.Reference.Path,
                ["id"] = doc.Id,
            };
            foreach (var pair in doc.ToDictionary())
                record[pair.Key] = pair.Value ?? "null";
            return record;
        }

        private async Task ExportBacpacAsync(string targetPath, CancellationToken cancellationToken)
        {
            var fileName = ResolveSqlPackagePath();
            var connectionString = _config.GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException("Connection string 'DefaultConnection' is missing.");

            var psi = new ProcessStartInfo
            {
                FileName = fileName,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            psi.ArgumentList.Add("/Action:Export");
            psi.ArgumentList.Add($"/SourceConnectionString:{connectionString}");
            psi.ArgumentList.Add($"/TargetFile:{targetPath}");

            Process? process;
            try
            {
                process = Process.Start(psi);
            }
            catch (Win32Exception ex)
            {
                // Resolved path exists but still won't launch (bad config, arch, ...).
                throw new InvalidOperationException(
                    $"Could not start sqlpackage ('{fileName}'): {ex.Message}. " +
                    "Install it (winget install Microsoft.SqlPackage) or fix Backup:SqlPackagePath, " +
                    "or deselect the .bacpac category.", ex);
            }
            if (process == null)
            {
                throw new InvalidOperationException(
                    $"Could not start sqlpackage ('{fileName}'). " +
                    "Install it (winget install Microsoft.SqlPackage) or fix Backup:SqlPackagePath, " +
                    "or deselect the .bacpac category.");
            }

            using (process)
            {
                using var killOnCancel = cancellationToken.Register(() =>
                {
                    try { if (!process.HasExited) process.Kill(entireProcessTree: true); }
                    catch { /* already gone */ }
                });

                var stdOut = await process.StandardOutput.ReadToEndAsync(cancellationToken);
                var stdErr = await process.StandardError.ReadToEndAsync(cancellationToken);
                await process.WaitForExitAsync(cancellationToken);

                if (process.ExitCode != 0)
                {
                    var detail = string.IsNullOrWhiteSpace(stdErr) ? stdOut : stdErr;
                    detail = detail.Trim();
                    if (detail.Length > 800) detail = detail[^800..];
                    throw new InvalidOperationException(
                        $"sqlpackage export failed (exit code {process.ExitCode}): {detail}");
                }
            }

            _logger.LogInformation("Bacpac exported to {Path} ({Bytes} bytes)",
                targetPath, new FileInfo(targetPath).Length);
        }

        // Explicit config wins; otherwise PATH; otherwise the places sqlpackage
        // actually lands on Windows installs (winget's versioned package dir,
        // dotnet global tool, Azure Data Studio's bundled copy) — the direct
        // paths keep working in processes whose PATH predates the install.
        private string ResolveSqlPackagePath()
        {
            var configured = _config["Backup:SqlPackagePath"];
            if (!string.IsNullOrWhiteSpace(configured))
                return configured;

            if (FindOnPath("sqlpackage.exe") is { } onPath)
                return onPath;

            var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);

            // winget installs to a versioned folder: Packages\Microsoft.SqlPackage_<source>\sqlpackage.exe
            try
            {
                var wingetPackages = Path.Combine(localAppData, "Microsoft", "WinGet", "Packages");
                foreach (var packageDir in Directory.GetDirectories(wingetPackages, "Microsoft.SqlPackage_*"))
                {
                    var exe = Path.Combine(packageDir, "sqlpackage.exe");
                    if (File.Exists(exe))
                        return exe;
                }
            }
            catch
            {
                // No winget Packages dir — fall through.
            }

            var candidates = new[]
            {
                Path.Combine(userProfile, ".dotnet", "tools", "sqlpackage.exe"),
                Path.Combine(localAppData, "Programs", "Azure Data Studio", "resources", "app", "extensions", "mssql", "sqlpackage", "sqlpackage.exe"),
            };
            foreach (var candidate in candidates)
            {
                if (File.Exists(candidate))
                    return candidate;
            }

            throw new InvalidOperationException(
                "sqlpackage was not found on this machine — the .bacpac export needs it. " +
                "Install it (winget install Microsoft.SqlPackage), or set Backup:SqlPackagePath in " +
                "appsettings.Development.json, or deselect the .bacpac category.");
        }

        private static string? FindOnPath(string executable)
        {
            var path = Environment.GetEnvironmentVariable("PATH");
            if (string.IsNullOrEmpty(path)) return null;

            foreach (var dir in path.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
            {
                try
                {
                    var full = Path.Combine(dir.Trim(), executable);
                    if (File.Exists(full)) return full;
                }
                catch
                {
                    // Malformed PATH segment — skip it.
                }
            }
            return null;
        }

        // ---------- shared helpers ----------

        private static IReadOnlyCollection<string> NormalizeKeys(IReadOnlyCollection<string> categoryKeys)
        {
            var normalized = categoryKeys
                .Where(k => !string.IsNullOrWhiteSpace(k))
                .Select(k => k.Trim().ToLowerInvariant())
                .ToHashSet(StringComparer.Ordinal);

            var unknown = normalized.Where(k => !AllKeys.Contains(k)).ToList();
            if (unknown.Count > 0)
                throw new ArgumentException($"Unknown backup categories: {string.Join(", ", unknown)}");
            if (normalized.Count == 0)
                throw new ArgumentException("At least one backup category is required.");

            return normalized;
        }

        private static async Task AddJsonEntryAsync<T>(
            ZipArchive zip,
            string entryName,
            T payload,
            CancellationToken cancellationToken)
        {
            var entry = zip.CreateEntry(entryName, CompressionLevel.Optimal);
            await using var stream = entry.Open();
            await JsonSerializer.SerializeAsync(stream, payload, ExportJsonOptions, cancellationToken);
        }

        private static string? SanitizeRelativePath(string blobName)
        {
            var parts = blobName
                .Split('/', StringSplitOptions.RemoveEmptyEntries)
                .Where(p => p is not "." and not "..")
                .ToArray();
            if (parts.Length == 0) return null;
            return Path.Combine(parts);
        }

        private void PruneOldBackups(string outputFolder, int keepCount)
        {
            if (keepCount <= 0) return;

            try
            {
                var dirs = Directory
                    .GetDirectories(outputFolder, "backup_*")
                    .Where(d => Path.GetFileName(d).Length > "backup_".Length)
                    .OrderByDescending(d => Path.GetFileName(d), StringComparer.Ordinal)
                    .ToList();

                foreach (var stale in dirs.Skip(keepCount))
                {
                    Directory.Delete(stale, recursive: true);
                    _logger.LogInformation("Pruned old scheduled backup {Folder}", stale);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not prune old backups in {Folder}", outputFolder);
            }
        }

        // ---------- stats ----------

        private sealed record Snapshot(
            Dictionary<string, long>? DatabaseCounts,
            long? DatabaseTotal,
            IReadOnlyList<BackupManifestThesisFileDto> ThesisFiles,
            long? FirestoreTotal,
            Dictionary<string, long>? FirestoreCounts)
        {
            public long? ThesisFilesSizeBytes =>
                ThesisFiles.Count == 0 ? 0 : ThesisFiles.Sum(f => f.SizeBytes);
        }

        private async Task<Snapshot> TakeSnapshotAsync(CancellationToken cancellationToken)
        {
            var databaseCounts = new Dictionary<string, long>
            {
                ["students"] = await _db.Students.CountAsync(cancellationToken),
                ["admins"] = await _db.Admins.CountAsync(cancellationToken),
                ["faculties"] = await _db.Faculties.CountAsync(cancellationToken),
                ["programHeads"] = await _db.ProgramHeads.CountAsync(cancellationToken),
                ["researchGroups"] = await _db.ResearchGroups.CountAsync(cancellationToken),
                ["theses"] = await _db.Theses.CountAsync(cancellationToken),
                ["thesisVersions"] = await _db.ThesisVersions.CountAsync(cancellationToken),
                ["submissions"] = await _db.Submissions.CountAsync(cancellationToken),
                ["reviews"] = await _db.Reviews.CountAsync(cancellationToken),
                ["schedules"] = await _db.Schedules.CountAsync(cancellationToken),
                ["panelistSchedules"] = await _db.PanelistSchedules.CountAsync(cancellationToken),
                ["announcements"] = await _db.Announcements.CountAsync(cancellationToken),
                ["notifications"] = await _db.Notifications.CountAsync(cancellationToken),
                ["chatSessions"] = await _db.ChatSessions.CountAsync(cancellationToken),
            };

            var files = await _blobs.ListPdfBlobsAsync(cancellationToken);

            var firestoreCounts = new Dictionary<string, long>();
            try
            {
                var annotationsTask = _firestore.CollectionGroup("annotations").GetSnapshotAsync(cancellationToken);
                var abstractsTask = _firestore.Collection("thesis_abstracts").GetSnapshotAsync(cancellationToken);
                var messagesTask = _firestore.CollectionGroup("messages").GetSnapshotAsync(cancellationToken);
                var annotations = await annotationsTask;
                var abstracts = await abstractsTask;
                var messages = await messagesTask;
                firestoreCounts["annotations"] = annotations.Count();
                firestoreCounts["abstracts"] = abstracts.Count();
                firestoreCounts["chatMessages"] = messages.Count();
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Could not count Firestore documents for backup stats");
                firestoreCounts.Clear();
            }

            return new Snapshot(
                DatabaseCounts: databaseCounts,
                DatabaseTotal: databaseCounts.Values.Sum(),
                ThesisFiles: files,
                FirestoreTotal: firestoreCounts.Count == 0 ? null : firestoreCounts.Values.Sum(),
                FirestoreCounts: firestoreCounts.Count == 0 ? null : firestoreCounts);
        }

        private static BackupStatsDto ToStats(Snapshot snapshot)
        {
            var categories = new List<BackupCategoryStatsDto>
            {
                new()
                {
                    Key = DatabaseKey,
                    Name = "Database Records (JSON)",
                    RecordCount = snapshot.DatabaseTotal,
                    SizeBytes = null,
                    Unit = "rows",
                },
                new()
                {
                    Key = BacpacKey,
                    Name = "Database Snapshot (.bacpac)",
                    RecordCount = null,
                    SizeBytes = null,
                    Unit = "export",
                },
                new()
                {
                    Key = ThesisFilesKey,
                    Name = "Thesis Files (PDF)",
                    RecordCount = snapshot.ThesisFiles.Count,
                    SizeBytes = snapshot.ThesisFilesSizeBytes,
                    Unit = "files",
                },
                new()
                {
                    Key = FirestoreKey,
                    Name = "Firestore Documents",
                    RecordCount = snapshot.FirestoreTotal,
                    SizeBytes = null,
                    Unit = "docs",
                },
            };

            var measurable = categories.Where(c => c.SizeBytes != null).ToList();
            return new BackupStatsDto
            {
                GeneratedAt = DateTimeOffset.UtcNow,
                TotalSizeBytes = measurable.Count == 0 ? null : measurable.Sum(c => c.SizeBytes!.Value),
                Categories = categories,
            };
        }

        private static JsonSerializerOptions CreateExportJsonOptions()
        {
            var options = new JsonSerializerOptions(JsonSerializerDefaults.Web)
            {
                ReferenceHandler = ReferenceHandler.IgnoreCycles,
            };
            options.TypeInfoResolver = new DefaultJsonTypeInfoResolver
            {
                Modifiers =
                {
                    static typeInfo =>
                    {
                        for (var i = typeInfo.Properties.Count - 1; i >= 0; i--)
                        {
                            var name = typeInfo.Properties[i].Name;
                            if (string.Equals(name, "TotpSecretEncrypted", StringComparison.OrdinalIgnoreCase) ||
                                string.Equals(name, "RecoveryCodeHashes", StringComparison.OrdinalIgnoreCase))
                            {
                                typeInfo.Properties.RemoveAt(i);
                            }
                        }
                    },
                },
            };
            return options;
        }
    }
}
