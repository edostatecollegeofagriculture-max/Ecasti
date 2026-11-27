$path = '.\server\apiRouter.ts'
$lines = Get-Content $path

Write-Host "Total lines: $($lines.Count)" -ForegroundColor Cyan
Write-Host "=== Lines 2178-2210 (0-indexed 2177-2209) ===" -ForegroundColor Yellow
for ($i = 2177; $i -lt [Math]::Min(2210, $lines.Count); $i++) {
  Write-Host ("{0,4}: {1}" -f ($i + 1), $lines[$i])
}

# Identify the SECOND block boundaries by content
$mismatchLineNumbers = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match 'const mismatchedLevelCourses = courses\.filter') {
    $mismatchLineNumbers += $i
  }
}

Write-Host "`nFound mismatchedLevelCourses at 0-indexed lines: $($mismatchLineNumbers -join ', ')" -ForegroundColor Cyan

if ($mismatchLineNumbers.Count -ne 2) {
  Write-Error "Expected exactly 2 occurrences, found $($mismatchLineNumbers.Count)"
  exit 1
}

# The second block starts a bit before the second mismatchedLevelCourses (the "// LEVEL GATING" line)
# and ends after "All selected courses must belong to your programme.' });" + closing "  }"
$secondMismatch = $mismatchLineNumbers[1]

# Walk backwards to find the "// LEVEL GATING" comment (max 3 lines back)
$blockStart = $secondMismatch
for ($i = $secondMismatch; $i -ge $secondMismatch - 3; $i--) {
  if ($lines[$i] -match '// LEVEL GATING') { $blockStart = $i; break }
}

# Walk forwards to find the closing "  }" of the programmeId check (max 20 lines forward)
$blockEnd = $secondMismatch
for ($i = $secondMismatch; $i -lt [Math]::Min($secondMismatch + 20, $lines.Count); $i++) {
  if ($lines[$i] -match "All selected courses must belong to your programme") {
    # The closing is on the next line that is just "  }"
    for ($j = $i; $j -lt [Math]::Min($i + 5, $lines.Count); $j++) {
      if ($lines[$j] -match '^\s*\}\s*$') { $blockEnd = $j; break }
    }
    break
  }
}

# Also consume the trailing blank line if present
if ($blockEnd + 1 -lt $lines.Count -and $lines[$blockEnd + 1].Trim() -eq '') {
  $blockEnd++
}

Write-Host "`nRemoving lines $($blockStart + 1) to $($blockEnd + 1) ($($blockEnd - $blockStart + 1) lines)" -ForegroundColor Yellow
Write-Host "=== Content being removed ===" -ForegroundColor Yellow
for ($i = $blockStart; $i -le $blockEnd; $i++) {
  Write-Host ("{0,4}: {1}" -f ($i + 1), $lines[$i])
}

# Remove the block
$newLines = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($i -ge $blockStart -and $i -le $blockEnd) { continue }
  $newLines += $lines[$i]
}

$newLines | Set-Content $path -Encoding UTF8 -NoNewline

# Verify only one remains
$final = Get-Content $path -Raw
$count = ([regex]::Matches($final, [regex]::Escape("const mismatchedLevelCourses = courses.filter"))).Count
Write-Host "`nmismatchedLevelCourses declarations remaining: $count" -ForegroundColor Cyan
if ($count -eq 1) { Write-Host "REMOVED: duplicate level gate" -ForegroundColor Green }
