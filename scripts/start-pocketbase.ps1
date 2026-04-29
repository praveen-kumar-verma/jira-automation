param(
  [string]$PocketBasePath = ".\pocketbase.exe",
  [string]$EnvPath = ".\.env",
  [string]$ServeAddress = "127.0.0.1:8090"
)

if (-not (Test-Path -LiteralPath $PocketBasePath)) {
  Write-Error "PocketBase executable not found at $PocketBasePath. Download pocketbase.exe and place it in the project root, or pass -PocketBasePath."
  exit 1
}

if (Test-Path -LiteralPath $EnvPath) {
  Get-Content -LiteralPath $EnvPath | ForEach-Object {
    $line = $_.Trim()

    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
      return
    }

    $name, $value = $line.Split("=", 2)
    [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), "Process")
  }
}

& $PocketBasePath serve --http $ServeAddress
