$ErrorActionPreference = 'Stop'
$file = Join-Path (Get-Location) 'server\apiRouter.ts'
if (-not (Test-Path $file)) { throw 'Run this from the EDOCASTI-LOCAL project root.' }

$content = [System.IO.File]::ReadAllText($file)
$old = 'studentName: student.fullName || student.matricNumber,'
$new = 'studentName: student.matricNumber,'

if ($content.Contains($old)) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    Copy-Item $file "$file.before-audit-name-fix-$stamp.bak"
    $content = $content.Replace($old, $new)
    [System.IO.File]::WriteAllText($file, $content, [System.Text.UTF8Encoding]::new($false))
    Write-Host 'Updated audit studentName to use matricNumber. Backup created.' -ForegroundColor Green
} elseif ($content.Contains($new)) {
    Write-Host 'Audit name fix is already present; no change needed.' -ForegroundColor Yellow
} else {
    throw 'Could not find the expected audit studentName line. No change made.'
}

$verify = [System.IO.File]::ReadAllText($file)
if (-not $verify.Contains($new)) { throw 'Verification failed.' }
Write-Host 'Verified audit studentName uses matricNumber.' -ForegroundColor Green
