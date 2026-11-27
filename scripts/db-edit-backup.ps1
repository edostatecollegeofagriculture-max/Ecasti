$ErrorActionPreference = "Stop"
$dbPath = ".\server\db.ts"
$backupDir = ".\_backups\db-ts-edits"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $backupDir "db.ts.$stamp.bak"

if (-not (Test-Path $dbPath)) { throw "Not found: $dbPath" }
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Copy-Item $dbPath $backupPath
$hash = (Get-FileHash $dbPath -Algorithm SHA256).Hash

Write-Host "Backup created:  $backupPath"
Write-Host "Original SHA256: $hash"
Write-Host ""

$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $dbPath))
$hasBOM = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
if ($hasBOM) { $text = $text.TrimStart([char]0xFEFF) }

Write-Host "BOM present:        $hasBOM"
Write-Host "Has CRLF endings:   $($text.Contains([string][char]13 + [string][char]10))"
Write-Host ""

$methodHits = ([regex]::Matches($text, 'initializePersistentStore\s*\(\s*\)')).Count
$guardHits  = ([regex]::Matches($text, 'if\s*\(\s*!STAGING_DEMO_ONLY\s*\)\s*return\s*;')).Count
$markerHits = ([regex]::Matches($text, 'EDOCASTI_USE_POSTGRES_STATE')).Count

Write-Host "initializePersistentStore occurrences:   $methodHits  (must be 1)"
Write-Host "STAGING_DEMO_ONLY guard occurrences:     $guardHits   (must be 1)"
Write-Host "EDOCASTI_USE_POSTGRES_STATE occurrences: $markerHits (must be 0 - edit not yet applied)"
Write-Host ""

if ($methodHits -ne 1) { throw "Aborting: wrong number of initializePersistentStore matches." }
if ($guardHits -ne 1)  { throw "Aborting: wrong number of STAGING_DEMO_ONLY guards." }
if ($markerHits -ne 0) { throw "Aborting: edit appears to already be applied." }

Write-Host "Pre-checks passed. Safe to edit by hand."
Write-Host ""
Write-Host "Restore command if needed:"
Write-Host "  Copy-Item '$backupPath' '.\server\db.ts' -Force"