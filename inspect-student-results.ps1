
$path = ".\src\views\StudentPortal.tsx"

Write-Host "`n===== RESULT FILTERING AND STATE =====" -ForegroundColor Cyan
Get-Content $path | Select-Object -Skip 170 -First 45

Write-Host "`n===== COMPLETE RESULTS SECTION =====" -ForegroundColor Cyan
Get-Content $path | Select-Object -Skip 430 -First 115

Write-Host "`n===== COURSE AND RESULT TYPE DEFINITIONS =====" -ForegroundColor Cyan
Select-String -Path .\src\types\*.ts -Pattern "interface Course|interface AssessmentResult|creditUnits|gradePoint" -Context 2,12

Write-Host "`n===== ACADEMIC GPA CALCULATION =====" -ForegroundColor Cyan
Select-String -Path .\server\*.ts -Pattern "recalculateStudentAcademicTotals|totalCreditsEarned|cgpa" -Context 3,12
