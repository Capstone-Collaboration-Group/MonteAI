# Local preparation only: no Azure commands, dependency restore, application
# startup, database access, migrations, or reads of development credentials.
[CmdletBinding()]
param(
    [string]$OutputRoot = (Join-Path ([System.IO.Path]::GetTempPath()) 'opencode')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$project = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../server.csproj'))
$serverDirectory = Split-Path $project -Parent
$forbiddenPath = '(?i)(^|/)(appsettings\.[^/]+\.json|[^/]*credential[^/]*\.json|\.env(?:\.[^/]*)?|[^/]+\.(pem|key|pfx|p12|user|log))$|(^|/)(\.vs|logs?|server\.Tests|\.secrets|\.certs)(/|$)'
$invalidArchivePath = '(^/|^[A-Za-z]:|\\|(^|/)\.\.(/|$))'

. (Join-Path $PSScriptRoot 'azure-package-guards.ps1')

# Inspect metadata, never file contents, for local-only content items. Fail
# before publishing if the project no longer protects them.
$metadataText = & dotnet msbuild $project -nologo '-getItem:Content'
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect publish metadata. Nothing was packaged.' }
try { $metadata = $metadataText | ConvertFrom-Json }
catch { throw 'Could not parse publish metadata. Nothing was packaged.' }
foreach ($item in $metadata.Items.Content) {
    if ($item.Identity.Replace('\', '/') -notmatch $forbiddenPath) { continue }
    $copy = $item.PSObject.Properties['CopyToPublishDirectory']
    if ($null -eq $copy -or $copy.Value -ne 'Never') {
        throw 'Publish blocked: a local-only content item is not excluded. No credential file was read.'
    }
}
Assert-NoSecretSettings (Read-PublicJson (Join-Path $serverDirectory 'appsettings.json'))

# An exclusive directory avoids overwriting previous artifacts or user work.
$runDirectory = Join-Path $OutputRoot ('monteai-api-' + [Guid]::NewGuid().ToString('N'))
$publishDirectory = Join-Path $runDirectory 'publish'
$archivePath = Join-Path $runDirectory 'monteai-api.zip'
New-Item -ItemType Directory -Path $publishDirectory | Out-Null

& dotnet publish $project --configuration Release --no-restore --no-self-contained `
    '-p:UseAppHost=false' --output $publishDirectory
if ($LASTEXITCODE -ne 0) {
    throw 'Release publish failed. No ZIP was created. Install/restore steps require separate approval.'
}

$files = @(Get-ChildItem -LiteralPath $publishDirectory -File -Recurse)
foreach ($file in $files) {
    $relative = $file.FullName.Substring($publishDirectory.Length + 1).Replace('\', '/')
    if ($relative -match $forbiddenPath) {
        throw 'Publish audit failed: local-only material was found. No ZIP was created; do not upload the publish directory.'
    }
}
foreach ($required in @('server.dll', 'server.deps.json', 'server.runtimeconfig.json', 'appsettings.json')) {
    if (-not (Test-Path -LiteralPath (Join-Path $publishDirectory $required) -PathType Leaf)) {
        throw "Publish audit failed: required file '$required' is missing."
    }
}
Assert-NoSecretSettings (Read-PublicJson (Join-Path $publishDirectory 'appsettings.json'))
$runtime = Read-PublicJson (Join-Path $publishDirectory 'server.runtimeconfig.json')
if ($runtime.runtimeOptions.tfm -ne 'net8.0') { throw 'This temporary package must target the approved net8.0 framework.' }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
# Windows PowerShell's ZipFile.CreateFromDirectory can emit backslashes.
# Explicit entry names preserve Linux directory structure on every host.
$archive = [System.IO.Compression.ZipFile]::Open(
    $archivePath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($publishDirectory.Length + 1).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive, $file.FullName, $relative,
            [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $archive.Dispose() }
$archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    if (-not ($archive.Entries.FullName -contains 'server.dll')) {
        throw 'ZIP audit failed: server.dll must be at the archive root.'
    }
    foreach ($entry in $archive.Entries) {
        if ($entry.FullName -match $invalidArchivePath) {
            throw 'ZIP audit failed: an entry path is not suitable for Linux. Do not upload this ZIP.'
        }
        if ($entry.FullName.Replace('\', '/') -match $forbiddenPath) {
            throw 'ZIP audit failed: local-only material was found. Do not upload this ZIP.'
        }
    }
    $entryCount = $archive.Entries.Count
} finally { $archive.Dispose() }

[PSCustomObject]@{
    PackagePath = $archivePath
    TargetFramework = 'net8.0'
    DeploymentMode = 'Framework-dependent; requires ASP.NET Core 8 on the host'
    EntryCount = $entryCount
    ArchiveBytes = (Get-Item -LiteralPath $archivePath).Length
    ForbiddenFiles = 0
    Sha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
} | ConvertTo-Json
