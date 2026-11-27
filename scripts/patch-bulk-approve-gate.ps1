$path = '.\server\apiRouter.ts'
$content = Get-Content $path -Raw

# Idempotency check
if ($content.Contains('LEVEL GATE (bulk-approve)')) {
  Write-Host "SKIP: bulk-approve level gate already present" -ForegroundColor Yellow
  exit 0
}

$bulkIdx = $content.IndexOf("'/registrations/approve-bulk'")
if ($bulkIdx -lt 0) { Write-Error "Bulk-approve route not found"; exit 1 }

# The exact one-line block to find
$oldBlock = "if (selected && withinHodDepartment && registration.status === 'SUBMITTED') {        registration.status = 'APPROVED_BY_HOD';        registration.approvedAt = now;"

# The new block inserts the level gate check before the status assignment
$newBlock = "if (selected && withinHodDepartment && registration.status === 'SUBMITTED') {        const bulkStudent = state.students.find((s) => s.id === registration.studentId);        const bulkLevelMismatch = bulkStudent ? registration.courseIds.filter((courseId) => { const course = state.courses.find((c) => c.id === courseId); return course && course.level !== bulkStudent.level; }) : [];        if (bulkLevelMismatch.length > 0) { skippedCount++; skippedReasons.push({ registrationId: registration.id, studentId: registration.studentId, courses: bulkLevelMismatch }); continue; }        registration.status = 'APPROVED_BY_HOD';        registration.approvedAt = now;"

if (-not $content.Contains($oldBlock)) {
  Write-Host "Anchor not found" -ForegroundColor Red
  Write-Host "=== Searching for anchor at bulkIdx ===" -ForegroundColor Yellow
  $snippet = $content.Substring($bulkIdx, [Math]::Min(1500, $content.Length - $bulkIdx))
  Write-Host $snippet
  exit 1
}

$content = $content.Replace($oldBlock, $newBlock)
Write-Host "PATCH OK: level gate inserted inside bulk-approve loop" -ForegroundColor Green

# Declare skippedCount and skippedReasons before the loop
$oldDecl = "let approvedCount = 0;    for (const registration of state.registrations) {"
$newDecl = "let approvedCount = 0;    let skippedCount = 0;    const skippedReasons = [];    for (const registration of state.registrations) {"

if ($content.Contains($oldDecl)) {
  $content = $content.Replace($oldDecl, $newDecl)
  Write-Host "PATCH OK: skippedCount and skippedReasons declared" -ForegroundColor Green
} else {
  Write-Host "WARN: declaration anchor not found" -ForegroundColor Yellow
}

# Update the return statement
$oldReturn = "return res.json({ success: true, approvedCount });"
$newReturn = "return res.json({ success: true, approvedCount, skippedCount, skippedReasons });"

if ($content.Contains($oldReturn)) {
  $content = $content.Replace($oldReturn, $newReturn)
  Write-Host "PATCH OK: return response includes skippedCount and skippedReasons" -ForegroundColor Green
} else {
  Write-Host "WARN: return anchor not found" -ForegroundColor Yellow
}

Set-Content $path $content -Encoding UTF8 -NoNewline
Write-Host "`nSaved." -ForegroundColor Cyan

# Verify
Select-String -Path $path -Pattern "LEVEL GATE \(bulk-approve\)|skippedCount|skippedReasons" | Select-Object -First 10 LineNumber, Line
