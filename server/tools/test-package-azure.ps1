# Offline checks of the package's public-configuration and path guards. No dependency
# restore, publish, live credentials, cloud calls, or application startup.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'package-azure.ps1'
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    $source, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -ne 0) { throw 'The package script has syntax errors.' }
$guardAst = [System.Management.Automation.Language.Parser]::ParseFile(
    (Join-Path $PSScriptRoot 'azure-package-guards.ps1'), [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -ne 0) { throw 'The shared package guards have syntax errors.' }
$functions = $guardAst.FindAll({
    param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
        $node.Name -eq 'Assert-NoSecretSettings'
}, $false)
if ($functions.Count -ne 1) { throw 'The public-configuration guard could not be located.' }
. ([ScriptBlock]::Create($functions[0].Extent.Text))

$marker = 'synthetic-only-never-display'
$cases = @(
    @{ Name = 'ordinary defaults'; Json = '{"AllowedHosts":"*","Auth":{"Issuer":"MonteAI"},"DataProtection":{"KeysPath":"/home/keys"}}'; Reject = $false },
    @{ Name = 'empty secret'; Json = '{"Auth":{"JwtSigningKey":""}}'; Reject = $false },
    @{ Name = 'null secret'; Json = '{"Pinecone":{"ApiKey":null}}'; Reject = $false },
    @{ Name = 'public receipt key'; Json = '{"IdVerification":{"PublicKeys":[{"KeyId":"public-test-id","PublicKeyPemBase64":"synthetic-public-material"}]}}'; Reject = $false },
    @{ Name = 'session signing secret'; Json = "{`"Auth`":{`"JwtSigningKey`":`"$marker`"}}"; Reject = $true },
    @{ Name = 'Firebase credentials'; Json = "{`"Firebase`":{`"AdminKeyPath`":`"$marker`"}}"; Reject = $true },
    @{ Name = 'embedding credential'; Json = "{`"AzureAIEmbedding`":{`"ApiKey`":`"$marker`"}}"; Reject = $true },
    @{ Name = 'SQL connection'; Json = "{`"ConnectionStrings`":{`"DefaultConnection`":`"$marker`"}}"; Reject = $true },
    @{ Name = 'other database connection'; Json = "{`"ConnectionStrings`":{`"Other`":`"$marker`"}}"; Reject = $true },
    @{ Name = 'array-nested secret'; Json = "{`"Entries`":[{`"ClientSecret`":`"$marker`"}]}"; Reject = $true },
    @{ Name = 'service-account private key'; Json = "{`"Firebase`":{`"private_key`":`"$marker`"}}"; Reject = $true },
    @{ Name = 'health secret'; Json = "{`"PING_SECRET`":`"$marker`"}"; Reject = $true }
)
foreach ($case in $cases) {
    $rejected = $false
    $synthetic = $case.Json | ConvertFrom-Json
    try { Assert-NoSecretSettings $synthetic }
    catch {
        $rejected = $true
        if ($_.Exception.Message.Contains($marker)) { throw 'A synthetic secret value escaped the guard.' }
        if (-not $_.Exception.Message.StartsWith('Publish blocked:')) { throw 'The guard failed unexpectedly.' }
    }
    if ($rejected -ne $case.Reject) { throw "Public-configuration guard failed: $($case.Name)." }
}

$patternMatch = [regex]::Match($ast.Extent.Text, "(?m)^\`$forbiddenPath = '([^']+)'")
if (-not $patternMatch.Success) { throw 'The forbidden-file rule could not be located.' }
$pattern = $patternMatch.Groups[1].Value
$pathCases = @(
    @{ Path = 'appsettings.Development.json'; Reject = $true },
    @{ Path = 'appsettings.Production.json'; Reject = $true },
    @{ Path = 'monteai-firebase-credential.json'; Reject = $true },
    @{ Path = '.env.local'; Reject = $true },
    @{ Path = '.certs/dev.pem'; Reject = $true },
    @{ Path = 'logs/request.json'; Reject = $true },
    @{ Path = 'server.Tests/test.dll'; Reject = $true },
    @{ Path = 'nested\secret.pfx'; Reject = $true },
    @{ Path = '.secrets/key.json'; Reject = $true },
    @{ Path = 'server.dll'; Reject = $false },
    @{ Path = 'server.runtimeconfig.json'; Reject = $false },
    @{ Path = 'appsettings.json'; Reject = $false },
    @{ Path = 'assets/images/cdm-logo.png'; Reject = $false }
)
foreach ($case in $pathCases) {
    if (($case.Path.Replace('\', '/') -match $pattern) -ne $case.Reject) {
        throw 'The forbidden-file rule did not produce the expected result.'
    }
}

$archivePatternMatch = [regex]::Match($ast.Extent.Text, "(?m)^\`$invalidArchivePath = '([^']+)'")
if (-not $archivePatternMatch.Success) { throw 'The Linux archive-path rule could not be located.' }
$archivePattern = $archivePatternMatch.Groups[1].Value
$archivePathCases = @(
    @{ Path = 'server.dll'; Reject = $false },
    @{ Path = 'assets/images/cdm-logo.png'; Reject = $false },
    @{ Path = 'runtimes/unix/lib/net6.0/Microsoft.Data.SqlClient.dll'; Reject = $false },
    @{ Path = 'assets\images\cdm-logo.png'; Reject = $true },
    @{ Path = '/server.dll'; Reject = $true },
    @{ Path = 'C:/server.dll'; Reject = $true },
    @{ Path = '../server.dll'; Reject = $true },
    @{ Path = 'nested/../server.dll'; Reject = $true }
)
foreach ($case in $archivePathCases) {
    if (($case.Path -match $archivePattern) -ne $case.Reject) {
        throw 'The Linux archive-path rule did not produce the expected result.'
    }
}
Write-Output "$($cases.Count + $pathCases.Count + $archivePathCases.Count) offline package guard checks passed. No private files or services were used."
