# Offline, synthetic-input checks. No restores, cloud calls, Docker builds,
# application startup, or reads of development configuration/credentials.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$tokens = $null
$parseErrors = $null
$source = Join-Path $PSScriptRoot 'package-azure-container.ps1'
$ast = [System.Management.Automation.Language.Parser]::ParseFile($source, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -ne 0) { throw 'The container-context script has syntax errors.' }
$functionNames = @('Get-ContainerRelativePath', 'Test-ForbiddenContainerPath', 'Get-ContainerBuildPaths', 'Assert-ContainerInputFile')
$definitions = $ast.FindAll({
    param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
        $node.Name -in $functionNames
}, $false)
if ($definitions.Count -ne $functionNames.Count) { throw 'The context guards could not be located.' }
. ([ScriptBlock]::Create(($definitions | ForEach-Object { $_.Extent.Text }) -join [Environment]::NewLine))

$pathCases = @(
    @{ Path = 'appsettings.Development.json'; Reject = $true },
    @{ Path = 'appsettings.Production.json'; Reject = $true },
    @{ Path = 'monteai-firebase-credential.json'; Reject = $true },
    @{ Path = 'nested/credentials.json'; Reject = $true },
    @{ Path = 'nested/secrets.json'; Reject = $true },
    @{ Path = '.env'; Reject = $true },
    @{ Path = '.env.local'; Reject = $true },
    @{ Path = '.certs/dev.pem'; Reject = $true },
    @{ Path = 'signing.key'; Reject = $true },
    @{ Path = 'certificate.pfx'; Reject = $true },
    @{ Path = 'certificate.p12'; Reject = $true },
    @{ Path = 'server.csproj.user'; Reject = $true },
    @{ Path = 'profile.pubxml'; Reject = $true },
    @{ Path = 'Properties/PublishProfiles/profile.pubxml.user'; Reject = $true },
    @{ Path = 'logs/request.json'; Reject = $true },
    @{ Path = 'server.Tests/test.cs'; Reject = $true },
    @{ Path = 'bin/Release/server.dll'; Reject = $true },
    @{ Path = 'obj/generated.cs'; Reject = $true },
    @{ Path = '.git/config'; Reject = $true },
    @{ Path = '.vs/state.json'; Reject = $true },
    @{ Path = '.secrets/key.json'; Reject = $true },
    @{ Path = 'old-build.zip'; Reject = $true },
    @{ Path = 'Dockerfile'; Reject = $false },
    @{ Path = '.dockerignore'; Reject = $false },
    @{ Path = 'server.csproj'; Reject = $false },
    @{ Path = 'appsettings.json'; Reject = $false },
    @{ Path = 'Program.cs'; Reject = $false },
    @{ Path = 'assets/images/cdm-logo.png'; Reject = $false }
)
foreach ($case in $pathCases) {
    if ((Test-ForbiddenContainerPath $case.Path) -ne $case.Reject) { throw 'A context forbidden-path check failed.' }
}

$relativeCases = @(
    @{ Path = 'Program.cs'; Expected = 'Program.cs'; Reject = $false },
    @{ Path = 'Models/Test.cs'; Expected = 'Models/Test.cs'; Reject = $false },
    @{ Path = 'assets\images\cdm-logo.png'; Expected = 'assets/images/cdm-logo.png'; Reject = $false },
    @{ Path = '/src/Program.cs'; Reject = $true },
    @{ Path = 'C:/Program.cs'; Reject = $true },
    @{ Path = '\\host\share\Program.cs'; Reject = $true },
    @{ Path = ''; Reject = $true },
    @{ Path = '.'; Reject = $true },
    @{ Path = './Program.cs'; Reject = $true },
    @{ Path = '..'; Reject = $true },
    @{ Path = 'Models/../Program.cs'; Reject = $true },
    @{ Path = 'Models//Program.cs'; Reject = $true },
    @{ Path = 'Models/'; Reject = $true }
)
foreach ($case in $relativeCases) {
    $rejected = $false
    try { $actual = Get-ContainerRelativePath $case.Path }
    catch {
        if (-not $_.Exception.Message.StartsWith('Context blocked:')) { throw 'The relative-path guard failed unexpectedly.' }
        $rejected = $true
    }
    if ($rejected -ne $case.Reject) { throw 'A context relative-path check failed.' }
    if (-not $case.Reject -and $actual -ne $case.Expected) { throw 'A context path was not normalized correctly.' }
}

function New-SyntheticMetadata {
    return @'
{
  "Properties": { "TargetFramework": "net8.0" },
  "Items": {
    "Compile": [{ "Identity": "Program.cs" }],
    "Content": [
      { "Identity": "appsettings.json" },
      { "Identity": "assets/images/cdm-logo.png" },
      { "Identity": "appsettings.Development.json", "CopyToPublishDirectory": "Never" },
      { "Identity": "monteai-firebase-credential.json", "CopyToPublishDirectory": "Never" }
    ],
    "EmbeddedResource": [],
    "ProjectReference": [],
    "AdditionalFiles": []
  }
}
'@ | ConvertFrom-Json
}
$metadataCases = @(
    @{ Name = 'ordinary inputs'; Edit = { param($m) }; Reject = $false },
    @{ Name = 'additional source'; Edit = { param($m) $m.Items.Compile += [PSCustomObject]@{ Identity = 'Models/Test.cs' } }; Reject = $false },
    @{ Name = 'wrong framework'; Edit = { param($m) $m.Properties.TargetFramework = 'net10.0' }; Reject = $true },
    @{ Name = 'embedded input'; Edit = { param($m) $m.Items.EmbeddedResource = @([PSCustomObject]@{ Identity = 'resource.resx' }) }; Reject = $true },
    @{ Name = 'project reference'; Edit = { param($m) $m.Items.ProjectReference = @([PSCustomObject]@{ Identity = '../other.csproj' }) }; Reject = $true },
    @{ Name = 'additional compiler input'; Edit = { param($m) $m.Items.AdditionalFiles = @([PSCustomObject]@{ Identity = 'other.txt' }) }; Reject = $true },
    @{ Name = 'test source'; Edit = { param($m) $m.Items.Compile += [PSCustomObject]@{ Identity = 'server.Tests/Test.cs' } }; Reject = $true },
    @{ Name = 'build output source'; Edit = { param($m) $m.Items.Compile += [PSCustomObject]@{ Identity = 'obj/generated.cs' } }; Reject = $true },
    @{ Name = 'outside source'; Edit = { param($m) $m.Items.Compile += [PSCustomObject]@{ Identity = '../shared.cs' } }; Reject = $true },
    @{ Name = 'rooted source'; Edit = { param($m) $m.Items.Compile += [PSCustomObject]@{ Identity = 'C:/shared.cs' } }; Reject = $true },
    @{ Name = 'hidden source'; Edit = { param($m) $m.Items.Compile += [PSCustomObject]@{ Identity = '.secrets/Test.cs' } }; Reject = $true },
    @{ Name = 'development publish enabled'; Edit = { param($m) $m.Items.Content[2].CopyToPublishDirectory = 'Always' }; Reject = $true },
    @{ Name = 'credential exclusion missing'; Edit = { param($m) $m.Items.Content[3].PSObject.Properties.Remove('CopyToPublishDirectory') }; Reject = $true },
    @{ Name = 'unexpected content'; Edit = { param($m) $m.Items.Content += [PSCustomObject]@{ Identity = 'other.json' } }; Reject = $true },
    @{ Name = 'logo missing'; Edit = { param($m) $m.Items.Content = @($m.Items.Content | Where-Object { $_.Identity -ne 'assets/images/cdm-logo.png' }) }; Reject = $true },
    @{ Name = 'program missing'; Edit = { param($m) $m.Items.Compile = @() }; Reject = $true },
    @{ Name = 'non-CSharp compile input'; Edit = { param($m) $m.Items.Compile += [PSCustomObject]@{ Identity = 'other.ps1' } }; Reject = $true },
    @{ Name = 'excluded dotenv'; Edit = { param($m) $m.Items.Content += [PSCustomObject]@{ Identity = '.env.local'; CopyToPublishDirectory = 'Never' } }; Reject = $false }
)
foreach ($case in $metadataCases) {
    $metadata = New-SyntheticMetadata
    & $case.Edit $metadata
    $rejected = $false
    try { $paths = @(Get-ContainerBuildPaths $metadata) }
    catch {
        if (-not $_.Exception.Message.StartsWith('Context blocked:')) { throw 'The build-input guard failed unexpectedly.' }
        $rejected = $true
    }
    if ($rejected -ne $case.Reject) { throw "A build-input check failed: $($case.Name)." }
    if (-not $case.Reject -and @($paths | Where-Object { Test-ForbiddenContainerPath $_ }).Count -ne 0) {
        throw 'An excluded synthetic file entered the build allowlist.'
    }
}

$fixture = Join-Path (Join-Path ([System.IO.Path]::GetTempPath()) 'opencode') ('container-guard-fixture-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path (Join-Path $fixture 'Models') | Out-Null
[System.IO.File]::WriteAllText((Join-Path $fixture 'Program.cs'), '// synthetic public fixture')
[System.IO.File]::WriteAllText((Join-Path $fixture 'Models/Test.cs'), '// synthetic public fixture')
$fileCases = @(
    @{ Path = 'Program.cs'; Reject = $false },
    @{ Path = 'Models/Test.cs'; Reject = $false },
    @{ Path = 'missing.cs'; Reject = $true },
    @{ Path = 'Models'; Reject = $true },
    @{ Path = '../Program.cs'; Reject = $true }
)
foreach ($case in $fileCases) {
    $rejected = $false
    try { Assert-ContainerInputFile $fixture $case.Path }
    catch {
        if (-not $_.Exception.Message.StartsWith('Context blocked:')) { throw 'The file-input guard failed unexpectedly.' }
        $rejected = $true
    }
    if ($rejected -ne $case.Reject) { throw 'A context file-input check failed.' }
}

$dockerfile = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../Dockerfile') -Raw
$dockerPatterns = @(
    '(?m)^FROM mcr\.microsoft\.com/dotnet/aspnet:8\.0 AS base\s*$',
    '(?m)^FROM mcr\.microsoft\.com/dotnet/sdk:8\.0 AS build\s*$',
    '(?m)^ENV ASPNETCORE_HTTP_PORTS=8080\s*$',
    '(?m)^ENV ASPNETCORE_ENVIRONMENT=Production\s*$',
    '(?m)^EXPOSE 8080\s*$',
    '(?m)^USER \$APP_UID\s*$',
    'ENTRYPOINT \["dotnet", "server\.dll"\]',
    'RUN dotnet publish[^\r\n]+--no-restore[^\r\n]+/p:UseAppHost=false'
)
foreach ($pattern in $dockerPatterns) {
    if ($dockerfile -notmatch $pattern) { throw 'A Dockerfile contract check failed.' }
}
if ($dockerfile -match '(?m)^EXPOSE 8081\s*$') { throw 'The container must not expose a local HTTPS certificate port.' }
$count = $pathCases.Count + $relativeCases.Count + $metadataCases.Count + $fileCases.Count + $dockerPatterns.Count + 1
Write-Output "$count offline container-context checks passed. Only synthetic fixtures and deployment scripts were used."
