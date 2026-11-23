# Shared, side-effect-free checks for public configuration only.
# Never call these helpers with local development/credential files.
function Read-PublicJson([string]$Path) {
    try { return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json }
    catch { throw 'A public configuration file could not be parsed. No file contents were displayed.' }
}

function Assert-NoSecretSettings($Node, [string]$Prefix = '') {
    if ($Node -is [System.Management.Automation.PSCustomObject]) {
        foreach ($property in $Node.PSObject.Properties) {
            $path = if ($Prefix) { "$Prefix`:$($property.Name)" } else { $property.Name }
            $secretName = $property.Name -match '^(ApiKey|WebApiKey|JwtSigningKey|AdminKeyPath|ConnectionString|ClientSecret|Password|AccessKey|PrivateKey|PrivateKeyPemBase64|private_key|client_secret|PING_SECRET)$'
            if (($secretName -or $path.StartsWith('ConnectionStrings:', [StringComparison]::OrdinalIgnoreCase)) -and
                $null -ne $property.Value -and -not [string]::IsNullOrWhiteSpace([string]$property.Value)) {
                throw "Publish blocked: populated secret setting '$path' belongs in Azure configuration, not appsettings.json. No value was displayed."
            }
            Assert-NoSecretSettings $property.Value $path
        }
    } elseif ($Node -is [System.Array]) {
        for ($i = 0; $i -lt $Node.Count; $i++) { Assert-NoSecretSettings $Node[$i] "$Prefix`:$i" }
    }
}
