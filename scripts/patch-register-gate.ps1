$path = '.\server\apiRouter.ts'
$content = Get-Content $path -Raw
$nl = [Environment]::NewLine

$registerIdx = $content.IndexOf("'/registrations/register'")
if ($registerIdx -lt 0) { Write-Error "Register route not found"; exit 1 }

$anchor = "const totalCredits = courses.reduce((sum, c) => sum + c.creditUnits, 0);"
$tcIdx = $content.IndexOf($anchor, $registerIdx)
if ($tcIdx -lt 0) { Write-Error "totalCredits anchor not found"; exit 1 }
$tcEnd = $tcIdx + $anchor.Length

$gate = $nl + $nl
$gate += "  // LEVEL GATING: student.level must match every requested course.level." + $nl
$gate += "  const mismatchedLevelCourses = courses.filter((c) => c.level !== student.level);" + $nl
$gate += "  if (mismatchedLevelCourses.length > 0) {" + $nl
$gate += "    return res.status(403).json({" + $nl
$gate += "      success: false," + $nl
$gate += "      message: 'You cannot register courses outside your current level. You are at ' + student.level + ', but attempted: ' + mismatchedLevelCourses.map((c) => c.code + ' (' + c.level + ')').join(', ') + '.'," + $nl
$gate += "    });" + $nl
$gate += "  }" + $nl
$gate += "  if (courses.some((c) => c.programmeId !== student.programmeId)) {" + $nl
$gate += "    return res.status(403).json({ success: false, message: 'All selected courses must belong to your programme.' });" + $nl
$gate += "  }" + $nl

$content = $content.Substring(0, $tcEnd) + $gate + $content.Substring($tcEnd)
Set-Content $path $content -Encoding UTF8 -NoNewline
Write-Host "PATCH OK: register route level gate inserted" -ForegroundColor Green

Select-String -Path $path -Pattern "LEVEL GATING|mismatchedLevelCourses" | Select-Object LineNumber, Line
