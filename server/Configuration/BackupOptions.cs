// server/Configuration/BackupOptions.cs
//
// Backup settings bound from the "Backup" section of appsettings*.json.
// Scheduled backups default to OFF so a fresh clone never writes files to
// disk; flip Backup:Scheduled:Enabled + set OutputFolder to turn them on.

namespace server.Configuration
{
    public class BackupOptions
    {
        public const string SectionName = "Backup";

        /// <summary>
        /// Full path to sqlpackage (used for .bacpac exports). Empty = resolve
        /// "sqlpackage" from PATH.
        /// </summary>
        public string SqlPackagePath { get; set; } = string.Empty;

        public BackupScheduledOptions Scheduled { get; set; } = new();
    }

    public class BackupScheduledOptions
    {
        /// <summary>Master switch. false = the hosted service only sleeps.</summary>
        public bool Enabled { get; set; }

        /// <summary>Folder that receives backup_&lt;stamp&gt; subfolders. Required when Enabled.</summary>
        public string OutputFolder { get; set; } = string.Empty;

        /// <summary>Hours between runs. 168 = weekly. Minimum 1.</summary>
        public int IntervalHours { get; set; } = 168;

        /// <summary>How many backup_* folders to keep; older ones are deleted. 0 = keep everything.</summary>
        public int KeepCount { get; set; } = 7;

        /// <summary>Categories written by scheduled runs (bacpac off by default — host tool dependency).</summary>
        public string[] Categories { get; set; } = ["database", "thesis-files", "firestore"];

        /// <summary>Append the bacpac category to scheduled runs.</summary>
        public bool IncludeBacpac { get; set; }
    }
}
