#requires -Version 5.1
$ErrorActionPreference = "Stop"

$dbPath     = ".\server\db.ts"
$backupDir  = ".\_backups\db-ts-edits"
$stamp      = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $backupDir "db.ts.$stamp.prefix.bak"

if (-not (Test-Path $dbPath)) { throw "Not found: $dbPath" }
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Copy-Item $dbPath $backupPath
$origHash = (Get-FileHash $dbPath -Algorithm SHA256).Hash
Write-Host "Backup: $backupPath"
Write-Host "Original SHA256: $origHash"
Write-Host ""

# Read as UTF-8, strip BOM if present.
$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $dbPath))
$hasBOM = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
$text   = [System.Text.Encoding]::UTF8.GetString($bytes)
if ($hasBOM) { $text = $text.TrimStart([char]0xFEFF) }
$usesCRLF = $text.Contains("`r`n")
Write-Host "BOM present: $hasBOM"
Write-Host "Line endings: $(if ($usesCRLF) {'CRLF'} else {'LF'})"
Write-Host ""

# Anchor: the exact method signature. Must appear exactly once.
$methodSig = 'public async initializePersistentStore(): Promise<void> {'
$sigCount = ([regex]::Matches($text, [regex]::Escape($methodSig))).Count
Write-Host "Method signature occurrences: $sigCount  (must be 1)"
if ($sigCount -ne 1) {
  throw "Aborting: method signature does not appear exactly once."
}
$sigIdx = $text.IndexOf($methodSig)

# Find the JSDoc block that ends immediately before the method signature.
# Backwards-scan from sigIdx: skip whitespace, expect "*/", scan back to "/**".
$scan = $sigIdx - 1
while ($scan -ge 0 -and [char]::IsWhiteSpace($text[$scan])) { $scan-- }
if ($scan -lt 2 -or $text.Substring($scan - 1, 2) -ne '*/') {
  throw "Aborting: no JSDoc comment ends immediately before the method signature."
}
$firstCloseIdx = $scan - 1  # index of the '/' in '*/'
$openMarker = '/**'
$openIdx = $text.LastIndexOf($openMarker, $firstCloseIdx, [System.StringComparison]::Ordinal)
if ($openIdx -lt 0) {
  throw "Aborting: could not find the matching JSDoc opening '/*'."
}
Write-Host "First JSDoc block ends at char $firstCloseIdx, starts at char $openIdx"

# Now check whether a SECOND JSDoc block ends immediately before this one.
$scan2 = $openIdx - 1
while ($scan2 -ge 0 -and [char]::IsWhiteSpace($text[$scan2])) { $scan2-- }
if ($scan2 -lt 2 -or $text.Substring($scan2 - 1, 2) -ne '*/') {
  Write-Host ""
  Write-Host "No duplicate JSDoc block found. Nothing to remove."
  Write-Host "Proceeding to BOM strip only."
  $secondOpenIdx = $openIdx  # no-op; we'll only remove BOM
} else {
  $secondCloseIdx = $scan2 - 1
  $secondOpenIdx = $text.LastIndexOf($openMarker, $secondCloseIdx, [System.StringComparison]::Ordinal)
  if ($secondOpenIdx -lt 0) {
    throw "Aborting: found a second '*/' but no matching '/*' opening before it."
  }
  Write-Host "Duplicate JSDoc block ends at char $secondCloseIdx, starts at char $secondOpenIdx"

  # Safety: the two blocks must be adjacent (only whitespace between them).
  $between = $text.Substring($secondCloseIdx + 2, $openIdx - ($secondCloseIdx + 2))
  if ($between.Trim().Length -ne 0) {
    throw ("Aborting: two JSDoc blocks are not adjacent. Content between them: [" +
           $between.Substring(0, [Math]::Min(200, $between.Length)) + "]")
  }

  # Remove the FIRST block (secondOpenIdx..secondCloseIdx+2) plus the trailing
  # whitespace/newline after it, so the second block becomes adjacent to the signature.
  $removeStart = $secondOpenIdx
  $removeEnd   = $openIdx  # exclusive — everything from second block start up to (not including) first block start
  # Note: openIdx is start of the KEPT block (the first-encountered one before signature).
  Write-Host "Removing chars [$removeStart..$($removeEnd-1)] ($($removeEnd - $removeStart) chars)"
  $text = $text.Substring(0, $removeStart) + $text.Substring($removeEnd)
}

# Write UTF-8 without BOM.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $dbPath), $text, $utf8NoBom)

# Re-read, verify.
$newBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $dbPath))
$newHasBOM = ($newBytes.Length -ge 3 -and $newBytes[0] -eq 0xEF -and $newBytes[1] -eq 0xBB -and $newBytes[2] -eq 0xBF)
$newText = [System.Text.Encoding]::UTF8.GetString($newBytes)
if ($newHasBOM) { Copy-Item $backupPath $dbPath -Force; throw "BOM still present after write. Backup restored." }

$markerCount = ([regex]::Matches($newText, 'EDOCASTI_USE_POSTGRES_STATE')).Count
$sigCountAfter = ([regex]::Matches($newText, [regex]::Escape($methodSig))).Count
$guardNewHits = ([regex]::Matches($newText, 'if\s*\(\s*!STAGING_DEMO_ONLY\s*&&\s*!LOCAL_POSTGRES_STATE\s*\)\s*return\s*;')).Count
$guardOldHits = ([regex]::Matches($newText, 'if\s*\(\s*!STAGING_DEMO_ONLY\s*\)\s*return\s*;')).Count

if ($sigCountAfter -ne 1) { Copy-Item $backupPath $dbPath -Force; throw "Method signature count changed to $sigCountAfter. Backup restored." }
if ($markerCount -ne 1)   { Copy-Item $backupPath $dbPath -Force; throw "Marker count is $markerCount (expected 1). Backup restored." }
if ($guardNewHits -ne 1)  { Copy-Item $backupPath $dbPath -Force; throw "New guard count is $guardNewHits (expected 1). Backup restored." }
if ($guardOldHits -ne 0)  { Copy-Item $backupPath $dbPath -Force; throw "Old guard still present. Backup restored." }

$newHash = (Get-FileHash $dbPath -Algorithm SHA256).Hash
Write-Host ""
Write-Host "=== FIX APPLIED ==="
Write-Host "Backup:          $backupPath"
Write-Host "Original SHA256: $origHash"
Write-Host "New SHA256:      $newHash"
Write-Host "BOM present:     $newHasBOM"
Write-Host "Marker count:    $markerCount  (expected 1)"
Write-Host "Method count:    $sigCountAfter  (expected 1)"
Write-Host "New guard count: $guardNewHits  (expected 1)"
Write-Host "Old guard count: $guardOldHits  (expected 0)"
Write-Host ""
Write-Host "Restore if needed:"
Write-Host "  Copy-Item '$backupPath' '.\server\db.ts' -Force"