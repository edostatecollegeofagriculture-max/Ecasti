$ErrorActionPreference = "Stop"
$dbPath = ".\server\db.ts"

$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $dbPath))
$hasBOM = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
if ($hasBOM) { $text = $text.TrimStart([char]0xFEFF) }

$methodHits = ([regex]::Matches($text, 'initializePersistentStore\s*\(\s*\)')).Count
$oldGuardHits = ([regex]::Matches($text, 'if\s*\(\s*!STAGING_DEMO_ONLY\s*\)\s*return\s*;')).Count
$newGuardHits = ([regex]::Matches($text, 'if\s*\(\s*!STAGING_DEMO_ONLY\s*&&\s*!LOCAL_POSTGRES_STATE\s*\)\s*return\s*;')).Count
$markerHits = ([regex]::Matches($text, 'EDOCASTI_USE_POSTGRES_STATE')).Count
$localBlockHits = ([regex]::Matches($text, 'if\s*\(\s*LOCAL_POSTGRES_STATE\s*&&\s*!STAGING_DEMO_ONLY\s*\)')).Count
$stagingGuardHits = ([regex]::Matches($text, 'RENDER_SERVICE_ID\s*!==\s*STAGING_RENDER_SERVICE_ID')).Count

Write-Host "BOM present:                              $hasBOM  (must be False)"
Write-Host "initializePersistentStore occurrences:    $methodHits  (must be 1)"
Write-Host "Old !STAGING_DEMO_ONLY guard occurrences: $oldGuardHits  (must be 0)"
Write-Host "New combined guard occurrences:           $newGuardHits  (must be 1)"
Write-Host "EDOCASTI_USE_POSTGRES_STATE occurrences:  $markerHits  (must be 1)"
Write-Host "Local-Postgres branch occurrences:        $localBlockHits  (must be 1)"
Write-Host "Staging guard occurrences:                $stagingGuardHits  (must be 1)"
Write-Host ""

$fail = $false
if ($hasBOM) { Write-Host "FAIL: BOM present in file."; $fail = $true }
if ($methodHits -ne 1) { Write-Host "FAIL: initializePersistentStore match count wrong."; $fail = $true }
if ($oldGuardHits -ne 0) { Write-Host "FAIL: old guard still present."; $fail = $true }
if ($newGuardHits -ne 1) { Write-Host "FAIL: new guard not found."; $fail = $true }
if ($markerHits -ne 1) { Write-Host "FAIL: marker not found or duplicated."; $fail = $true }
if ($localBlockHits -ne 1) { Write-Host "FAIL: local branch block not found."; $fail = $true }
if ($stagingGuardHits -ne 1) { Write-Host "FAIL: staging guard missing."; $fail = $true }

if ($fail) {
  Write-Host ""
  Write-Host "STRUCTURAL VERIFICATION FAILED."
  Write-Host "Restore from the backup printed by db-edit-backup.ps1."
  exit 1
}

Write-Host "STRUCTURAL VERIFICATION PASSED."
Write-Host ""
Write-Host "Running TypeScript type check..."
& npx tsc --noEmit -p . 2>&1
$tscExit = $LASTEXITCODE

if ($tscExit -eq 0) {
  Write-Host ""
  Write-Host "TSC PASSED. Edit is complete and safe."
} else {
  Write-Host ""
  Write-Host "TSC FAILED (exit $tscExit). Restore from backup and paste the error."
}
exit $tscExit