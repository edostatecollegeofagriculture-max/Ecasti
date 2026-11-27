$path = '.\server\apiRouter.ts'
$content = Get-Content $path -Raw
$nl = [Environment]::NewLine

# The second block is preceded by an extra blank line and starts with the marker comment
$secondMarker = "// LEVEL GATING: student.level must match every requested course.level."
$firstIdx = $content.IndexOf($secondMarker)
if ($firstIdx -lt 0) { Write-Error "First marker not found"; exit 1 }
$secondIdx = $content.IndexOf($secondMarker, $firstIdx + 1)
if ($secondIdx -lt 0) { Write-Error "Second marker not found (only one exists)"; exit 1 }

# The second block starts with "  // LEVEL GATING" but includes TWO preceding newlines from $nl+$nl
# Find the exact start of the block (including leading whitespace and preceding blank line)
$blockStart = $secondIdx - 2   # back up over "  " indent
# The block ends with the closing "}" of the programmeId check, followed by a blank line
$blockEndMarker = "All selected courses must belong to your programme.' });" + $nl + "  }"
$blockEndIdx = $content.IndexOf($blockEndMarker, $secondIdx)
if ($blockEndIdx -lt 0) { Write-Error "Block end marker not found"; exit 1 }
$blockEnd = $blockEndIdx + $blockEndMarker.Length

# Also remove the trailing blank line after the block
if ($content.Substring($blockEnd, 1) -eq $nl) { $blockEnd += 1 }
if ($content.Substring($blockEnd, 1) -eq $nl) { $blockEnd += 1 }

Write-Host "Removing block from char $blockStart to $blockEnd ($($blockEnd - $blockStart) chars)"
Write-Host "=== FIRST 300 chars being removed ===" -ForegroundColor Yellow
Write-Host $content.Substring($blockStart, [Math]::Min(300, $blockEnd - $blockStart))
Write-Host "..." -ForegroundColor Yellow

$content = $content.Substring(0, $blockStart) + $content.Substring($blockEnd)
Set-Content $path $content -Encoding UTF8 -NoNewline
Write-Host "`nREMOVED: duplicate level gate" -ForegroundColor Green

# Verify only one remains
$check = Get-Content $path -Raw
$count = ([regex]::Matches($check, [regex]::Escape("const mismatchedLevelCourses = courses.filter"))).Count
Write-Host "mismatchedLevelCourses declarations remaining: $count" -ForegroundColor Cyan
