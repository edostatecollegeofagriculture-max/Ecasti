$ErrorActionPreference = "Stop"
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$dir = ".\_backups\$ts"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

# 1. Backup source JSON (with hash)
$src = ".\data\edocasti_db.json"
if (Test-Path $src) {
  Copy-Item $src "$dir\edocasti_db.json.bak"
  (Get-FileHash $src -Algorithm SHA256).Hash |
    Set-Content "$dir\edocasti_db.json.sha256" -Encoding UTF8
  Write-Host "JSON backed up."
}

# 2. Dump the target database (if pg_dump available)
$url = $env:EDOCASTI_LOCAL_DATABASE_URL
if (-not $url) { $url = $env:DATABASE_URL }
if ($url) {
  try {
    & pg_dump $url --no-owner --no-privileges -f "$dir\edocasti_pg.dump.sql" 2>$null
    if (Test-Path "$dir\edocasti_pg.dump.sql") { Write-Host "DB dumped." }
    else { Write-Host "WARN: pg_dump produced no file." }
  } catch { Write-Host "WARN: pg_dump unavailable or failed. Skipping DB dump." }
} else { Write-Host "WARN: No DB URL found; skipping pg_dump." }

Write-Host "Backup written to $dir"
Get-ChildItem $dir | ForEach-Object { Write-Host "  $($_.Name)  $($_.Length) bytes" }