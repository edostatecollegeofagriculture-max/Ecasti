$path = '.\server\apiRouter.ts'
$content = Get-Content $path -Raw

$approveIdx = $content.IndexOf("'/registrations/:id/approve'")
if ($approveIdx -lt 0) { Write-Error "Approve route not found"; exit 1 }

$statusIdx = $content.IndexOf("reg.status = 'APPROVED_BY_HOD';", $approveIdx)
if ($statusIdx -lt 0) { Write-Error "Status assignment not found"; exit 1 }

$gate = "      // LEVEL GATE: reject approval if any course level differs from the student's current level." + [Environment]::NewLine
$gate += "      const gateStudent = db.getState().students.find((s) => s.id === reg.studentId);" + [Environment]::NewLine
$gate += "      if (gateStudent) {" + [Environment]::NewLine
$gate += "        const badCourses = db.getState().courses.filter(" + [Environment]::NewLine
$gate += "          (c) => reg.courseIds.includes(c.id) && c.level !== gateStudent.level" + [Environment]::NewLine
$gate += "        );" + [Environment]::NewLine
$gate += "        if (badCourses.length > 0) {" + [Environment]::NewLine
$gate += "          return res.status(409).json({" + [Environment]::NewLine
$gate += "            success: false," + [Environment]::NewLine
$gate += "            message: 'Cannot approve: registration contains courses outside student level (' + gateStudent.level + ').'," + [Environment]::NewLine
$gate += "          });" + [Environment]::NewLine
$gate += "        }" + [Environment]::NewLine
$gate += "      }" + [Environment]::NewLine
$gate += [Environment]::NewLine

$content = $content.Substring(0, $statusIdx) + $gate + $content.Substring($statusIdx)
Set-Content $path $content -Encoding UTF8 -NoNewline
Write-Host "PATCH OK: approve level gate inserted" -ForegroundColor Green

Select-String -Path $path -Pattern "LEVEL GATE.*approve|Cannot approve.*outside student" | Select-Object LineNumber, Line
