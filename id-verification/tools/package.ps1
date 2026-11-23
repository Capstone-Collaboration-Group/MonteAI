param(
    [string]$Output = "dist/id-verification-source.zip"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root ".venv/Scripts/python.exe"
if (-not (Test-Path $python)) {
    $python = (Get-Command python -ErrorAction Stop).Source
}

Push-Location $root
try {
    & $python -B -m tools.prepare_models --check
    if ($LASTEXITCODE -ne 0) { throw "Packaged OCR model verification failed." }

    $outputPath = [System.IO.Path]::GetFullPath((Join-Path $root $Output))
    $outputDirectory = Split-Path -Parent $outputPath
    New-Item -ItemType Directory -Force $outputDirectory | Out-Null
    if (Test-Path -LiteralPath $outputPath) {
        throw "Package output already exists; choose a new release path."
    }

    $stage = Join-Path ([System.IO.Path]::GetTempPath()) ("monteai-idv-package-" + [guid]::NewGuid())
    New-Item -ItemType Directory $stage | Out-Null
    try {
        foreach ($file in @("function_app.py", "host.json", "requirements.txt")) {
            Copy-Item (Join-Path $root $file) $stage
        }
        foreach ($directory in @("verification", "templates")) {
            Copy-Item (Join-Path $root $directory) $stage -Recurse
        }
        New-Item -ItemType Directory (Join-Path $stage "models") | Out-Null
        Copy-Item (Join-Path $root "models/manifest.json") (Join-Path $stage "models")
        Copy-Item (Join-Path $root "models/*.onnx") (Join-Path $stage "models")
        Get-ChildItem $stage -Recurse -Directory -Filter "__pycache__" |
            Remove-Item -Recurse -Force
        Copy-Item (Join-Path $root "licenses") $stage -Recurse
        # Compress-Archive on Windows can write backslash paths that break Linux imports.
        & $python -B -m tools.package_archive $stage $outputPath
        if ($LASTEXITCODE -ne 0) { throw "Source ZIP creation failed." }
    }
    finally {
        if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
    }

    Write-Host "Created $outputPath"
}
finally {
    Pop-Location
}
