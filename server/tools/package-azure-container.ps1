# Local preparation only: no Azure/Docker commands, dependency restore,
# application startup, database access, or reads of development credentials.
[CmdletBinding()]
param(
    [string]$OutputRoot = (Join-Path ([System.IO.Path]::GetTempPath()) 'opencode')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$project = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../server.csproj'))
$serverDirectory = Split-Path $project -Parent
. (Join-Path $PSScriptRoot 'azure-package-guards.ps1')

function Get-ContainerRelativePath([string]$Path) {
    $relative = $Path.Replace('\', '/')
    if ([string]::IsNullOrWhiteSpace($relative) -or
        $relative -match '(^/|^[A-Za-z]:|(^|/)\.\.?(\/|$)|//)' -or
        $relative.EndsWith('/')) {
        throw 'Context blocked: a build input path is not contained in the server directory.'
    }
    return $relative
}

function Test-ForbiddenContainerPath([string]$Path) {
    return $Path.Replace('\', '/') -match '(?i)(^|/)(appsettings\.[^/]+\.json|[^/]*(credential|secret)[^/]*\.json|\.env(?:\.[^/]*)?|[^/]+\.(pem|key|pfx|p12|user|log|zip|pubxml))$|(^|/)(\.git|\.vs|bin|obj|logs?|server\.Tests|\.secrets|\.certs|PublishProfiles)(/|$)'
}

function Get-ContainerBuildPaths($Metadata) {
    if ($Metadata.Properties.TargetFramework -ne 'net8.0') {
        throw 'Context blocked: this temporary container must target the approved net8.0 framework.'
    }
    foreach ($kind in @('EmbeddedResource', 'ProjectReference', 'AdditionalFiles')) {
        if (@($Metadata.Items.$kind).Count -ne 0) {
            throw 'Context blocked: additional build inputs require review before cloud upload.'
        }
    }
    $paths = [System.Collections.Generic.List[string]]::new()
    foreach ($required in @('Dockerfile', '.dockerignore', 'server.csproj')) { $paths.Add($required) }
    foreach ($item in $Metadata.Items.Compile) {
        $relative = Get-ContainerRelativePath $item.Identity
        if ((Test-ForbiddenContainerPath $relative) -or -not $relative.EndsWith('.cs', [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Context blocked: a compiled input is not an approved source file.'
        }
        $paths.Add($relative)
    }
    foreach ($item in $Metadata.Items.Content) {
        $relative = Get-ContainerRelativePath $item.Identity
        if (Test-ForbiddenContainerPath $relative) {
            $copy = $item.PSObject.Properties['CopyToPublishDirectory']
            if ($null -eq $copy -or $copy.Value -ne 'Never') {
                throw 'Context blocked: a local-only content item is not excluded. No credential file was read.'
            }
            continue
        }
        if ($relative -notin @('appsettings.json', 'assets/images/cdm-logo.png')) {
            throw 'Context blocked: additional content requires review before cloud upload.'
        }
        $paths.Add($relative)
    }
    foreach ($required in @('Program.cs', 'appsettings.json', 'assets/images/cdm-logo.png')) {
        if (-not $paths.Contains($required)) { throw 'Context blocked: a required build input is missing.' }
    }
    return @($paths | Sort-Object -Unique)
}

function Assert-ContainerInputFile([string]$Root, [string]$Relative) {
    $current = $Root
    foreach ($segment in (Get-ContainerRelativePath $Relative).Split('/')) {
        if (-not (Test-Path -LiteralPath $current)) { throw 'Context blocked: a build input is missing.' }
        if (((Get-Item -LiteralPath $current -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'Context blocked: linked files or directories cannot be uploaded.'
        }
        $current = Join-Path $current $segment
    }
    if (-not (Test-Path -LiteralPath $current -PathType Leaf)) { throw 'Context blocked: a build input is missing or not a file.' }
    if (((Get-Item -LiteralPath $current -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Context blocked: linked files or directories cannot be uploaded.'
    }
}

# MSBuild evaluation returns paths/metadata only. Unlike a recursive source copy,
# the allowlist never reads excluded local settings, credentials, logs, or tests.
$metadataText = & dotnet msbuild $project -nologo '-p:Configuration=Release' `
    '-getProperty:TargetFramework' '-getItem:Compile,Content,EmbeddedResource,ProjectReference,AdditionalFiles'
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect container build metadata. Nothing was packaged.' }
try { $metadata = $metadataText | ConvertFrom-Json }
catch { throw 'Could not parse container build metadata. No file contents were displayed.' }
$paths = @(Get-ContainerBuildPaths $metadata)
foreach ($relative in $paths) { Assert-ContainerInputFile $serverDirectory $relative }
Assert-NoSecretSettings (Read-PublicJson (Join-Path $serverDirectory 'appsettings.json'))

try { [xml]$projectXml = Get-Content -LiteralPath $project -Raw }
catch { throw 'Could not parse the project file. No contents were displayed.' }
$mapper = @($projectXml.SelectNodes('//PackageReference[@Include="AutoMapper"]'))
if ($mapper.Count -ne 1 -or $mapper[0].Version -ne '16.3.0') {
    throw 'Context blocked: the approved AutoMapper 16.3.0 patch must be retained.'
}
$dockerfile = Get-Content -LiteralPath (Join-Path $serverDirectory 'Dockerfile') -Raw
foreach ($image in @('aspnet', 'sdk')) {
    if ($dockerfile -notmatch "(?m)^FROM mcr\.microsoft\.com/dotnet/$image`:8\.0 AS ") {
        throw 'Context blocked: the Dockerfile must use the approved .NET 8 images.'
    }
}

$runDirectory = Join-Path $OutputRoot ('monteai-api-container-' + [Guid]::NewGuid().ToString('N'))
$contextDirectory = Join-Path $runDirectory 'context'
$archivePath = Join-Path $runDirectory 'monteai-api-container-context.zip'
$auditPath = Join-Path $runDirectory 'container-context-audit.json'
New-Item -ItemType Directory -Path $contextDirectory | Out-Null
foreach ($relative in $paths) {
    $destination = Join-Path $contextDirectory $relative
    New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $serverDirectory $relative) -Destination $destination
}
Assert-NoSecretSettings (Read-PublicJson (Join-Path $contextDirectory 'appsettings.json'))

$files = @(Get-ChildItem -LiteralPath $contextDirectory -File -Recurse)
if ($files.Count -ne $paths.Count) { throw 'Context audit failed: unexpected files were found. Do not upload this directory.' }
$manifest = foreach ($file in $files) {
    $relative = Get-ContainerRelativePath ($file.FullName.Substring($contextDirectory.Length + 1))
    if ((Test-ForbiddenContainerPath $relative) -or $relative -notin $paths) {
        throw 'Context audit failed: an unexpected file was found. Do not upload this directory.'
    }
    [PSCustomObject]@{ Path = $relative; Sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash }
}

# A source ZIP is only for safely moving this context into Cloud Shell.
# It is NOT a compiled App Service ZIP and must NOT be deployed as one.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($archivePath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($contextDirectory.Length + 1).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive, $file.FullName, $relative, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $archive.Dispose() }
$archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    if ($archive.Entries.Count -ne $paths.Count) { throw 'Context ZIP audit failed: unexpected entries were found.' }
    foreach ($entry in $archive.Entries) {
        $relative = Get-ContainerRelativePath $entry.FullName
        if ($entry.FullName.Contains('\') -or (Test-ForbiddenContainerPath $relative) -or $relative -notin $paths) {
            throw 'Context ZIP audit failed: an entry is not suitable for upload. Do not upload this ZIP.'
        }
    }
} finally { $archive.Dispose() }

$summary = [PSCustomObject]@{
    ContextPath = $contextDirectory
    ContextZipPath = $archivePath
    AuditReportPath = $auditPath
    TargetFramework = 'net8.0'
    AutoMapper = '16.3.0'
    RuntimeImage = 'mcr.microsoft.com/dotnet/aspnet:8.0'
    SdkImage = 'mcr.microsoft.com/dotnet/sdk:8.0'
    Platform = 'linux/amd64'
    FileCount = $files.Count
    ForbiddenFiles = 0
    InvalidLinuxPaths = 0
    ArchiveBytes = (Get-Item -LiteralPath $archivePath).Length
    Sha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
    DockerBuildVerified = $false
    PublishedToAzure = $false
}
$audit = [PSCustomObject]@{ Summary = $summary; Files = @($manifest | Sort-Object Path) }
[System.IO.File]::WriteAllText($auditPath, ($audit | ConvertTo-Json -Depth 5), [System.Text.UTF8Encoding]::new($false))
$summary | ConvertTo-Json
