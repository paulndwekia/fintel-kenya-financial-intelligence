param(
  [string]$OutputDirectory = ".\backups\production",
  [string]$ConnectionString = $env:FINTEL_DATABASE_URL
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
  throw "Set FINTEL_DATABASE_URL in this PowerShell session. Do not commit it or paste it into GitHub."
}

$dumpCommand = Get-Command "mysqldump" -ErrorAction SilentlyContinue
if (-not $dumpCommand) {
  throw "mysqldump was not found. Install the MySQL client tools, reopen PowerShell, and run this script again."
}

try {
  $uri = [System.Uri]::new($ConnectionString)
} catch {
  throw "FINTEL_DATABASE_URL is not a valid MySQL connection URI."
}

if ($uri.Scheme -notin @("mysql", "mysql2", "tidb")) {
  throw "Expected a mysql:// connection URI. This script does not support other database engines."
}

$databaseName = [System.Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart("/"))
$userInfo = [System.Uri]::UnescapeDataString($uri.UserInfo)
$credentialParts = $userInfo.Split(":", 2)

if ([string]::IsNullOrWhiteSpace($databaseName) -or $credentialParts.Count -ne 2 -or
    [string]::IsNullOrWhiteSpace($credentialParts[0]) -or
    [string]::IsNullOrWhiteSpace($uri.Host) -or $uri.Port -lt 1) {
  throw "The URI must include username, password, host, port and database name."
}

$username = $credentialParts[0]
$password = $credentialParts[1]
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$outputPath = Join-Path $OutputDirectory "fintel-full-$timestamp.sql"
$tempDefaults = Join-Path $env:TEMP ("fintel-mysqldump-" + [guid]::NewGuid().ToString("N") + ".cnf")

function Escape-MySqlOption([string]$Value) {
  return $Value.Replace("\", "\\").Replace('"', '\"').Replace([string][char]13, "\r").Replace([string][char]10, "\n")
}

$defaultsContent = @(
  "[client]"
  ('user="' + (Escape-MySqlOption $username) + '"')
  ('password="' + (Escape-MySqlOption $password) + '"')
  ('host="' + (Escape-MySqlOption $uri.Host) + '"')
  ('port=' + $uri.Port)
  "ssl-mode=REQUIRED"
) -join [Environment]::NewLine

try {
  Set-Content -LiteralPath $tempDefaults -Value $defaultsContent -Encoding ASCII
  $acl = Get-Acl -LiteralPath $tempDefaults
  $acl.SetAccessRuleProtection($true, $false)
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
    $identity,
    [System.Security.AccessControl.FileSystemRights]::FullControl,
    [System.Security.AccessControl.AccessControlType]::Allow
  )
  $acl.SetAccessRule($rule)
  Set-Acl -LiteralPath $tempDefaults -AclObject $acl

  Write-Host "Creating a TLS-protected FINTEL database backup..."
  Write-Host "Target: $outputPath"
  Write-Host "The database password will not be printed."

  $dumpArgs = @(
    "--defaults-extra-file=$tempDefaults"
    "--single-transaction"
    "--quick"
    "--routines"
    "--triggers"
    "--events"
    "--hex-blob"
    "--no-tablespaces"
    "--result-file=$outputPath"
    $databaseName
  )
  & $dumpCommand.Source @dumpArgs

  if ($LASTEXITCODE -ne 0) {
    throw "mysqldump failed with exit code $LASTEXITCODE. The output file is not a verified backup."
  }

  if (-not (Test-Path -LiteralPath $outputPath) -or (Get-Item -LiteralPath $outputPath).Length -lt 100) {
    throw "The dump file is missing or unexpectedly small."
  }

  $createTables = Select-String -LiteralPath $outputPath -Pattern "CREATE TABLE" -Quiet
  if (-not $createTables) {
    throw "The export does not contain CREATE TABLE statements. It is not a complete database dump."
  }

  $insertCount = (Select-String -LiteralPath $outputPath -Pattern "INSERT INTO|REPLACE INTO").Count
  $hash = (Get-FileHash -LiteralPath $outputPath -Algorithm SHA256).Hash

  Write-Host ""
  Write-Host "Backup file created and basic integrity checks passed."
  Write-Host "Tables: CREATE TABLE statements found"
  Write-Host "Data statements: $insertCount"
  Write-Host "SHA-256: $hash"
  Write-Warning "Keep this backup outside the Git repository. It may contain private user and portfolio data."
} finally {
  if (Test-Path -LiteralPath $tempDefaults) {
    Remove-Item -LiteralPath $tempDefaults -Force
  }
  $password = $null
  $userInfo = $null
  $defaultsContent = $null
}
