$path = '.\src\views\StudentPortal.tsx'
$content = Get-Content $path -Raw

$old = "api.getCourses({ departmentId: stdRes.student.departmentId }),"
$new = "api.getCourses({ departmentId: stdRes.student.departmentId }).then((r: any) => ({ ...r, courses: (r.courses || []).filter((c: any) => c.level === stdRes.student.level) })),"

if (-not $content.Contains($old)) {
  Write-Host "PATCH FAILED: StudentPortal anchor not found" -ForegroundColor Red
  Select-String -Path $path -Pattern "getCourses" | Select-Object LineNumber, Line
} else {
  $content = $content.Replace($old, $new)
  Set-Content $path $content -Encoding UTF8 -NoNewline
  Write-Host "PATCH OK: StudentPortal level filter added" -ForegroundColor Green
}
