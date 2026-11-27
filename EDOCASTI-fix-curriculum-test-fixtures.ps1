$ErrorActionPreference = 'Stop'

$projectRoot = 'C:\Users\EDSG-JOOPSA\Documents\EDOCASTI-LOCAL'
$target = Join-Path $projectRoot 'scripts\test-curriculum-assignment-temporary.ts'

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "Target file not found: $target"
}

$original = Get-Content -LiteralPath $target -Raw
$updated = $original

$replacements = @(
    @{
        Name = 'ND I first-semester fixture'
        Old = @'
    await addCurriculumCourse(mapping.id, {
      courseId: `TEST-COURSE-A-${tag}`,
      courseCode: 'TST101',
      courseTitle: 'Synthetic Required Course A',
      level: 'ND I',
      semester: 'First Semester',
      creditUnits: 2,
      compulsory: true,
    });
'@
        New = @'
    await addCurriculumCourse(mapping.id, {
      courseId: `TEST-COURSE-A-${tag}`,
      courseCode: 'TST101',
      courseTitle: 'Synthetic Required Course A',
      stageCode: 'ND_I',
      stageLabel: 'ND I',
      periodCode: 'FIRST_SEMESTER',
      periodLabel: 'First Semester',
      classification: 'COMPULSORY',
      legacyLevel: 'ND I',
      legacySemester: 'First Semester',
      creditUnits: 2,
    });
'@
    },
    @{
        Name = 'ND I second-semester fixture'
        Old = @'
    await addCurriculumCourse(mapping.id, {
      courseId: `TEST-COURSE-B-${tag}`,
      courseCode: 'TST102',
      courseTitle: 'Synthetic Required Course B',
      level: 'ND I',
      semester: 'Second Semester',
      creditUnits: 3,
      compulsory: true,
    });
'@
        New = @'
    await addCurriculumCourse(mapping.id, {
      courseId: `TEST-COURSE-B-${tag}`,
      courseCode: 'TST102',
      courseTitle: 'Synthetic Required Course B',
      stageCode: 'ND_I',
      stageLabel: 'ND I',
      periodCode: 'SECOND_SEMESTER',
      periodLabel: 'Second Semester',
      classification: 'COMPULSORY',
      legacyLevel: 'ND I',
      legacySemester: 'Second Semester',
      creditUnits: 3,
    });
'@
    },
    @{
        Name = 'ND II first-semester fixture'
        Old = @'
    await addCurriculumCourse(mapping.id, {
      courseId: `TEST-COURSE-C-${tag}`,
      courseCode: 'TST201',
      courseTitle: 'Synthetic Required ND II Course C',
      level: 'ND II',
      semester: 'First Semester',
      creditUnits: 2,
      compulsory: true,
    });
'@
        New = @'
    await addCurriculumCourse(mapping.id, {
      courseId: `TEST-COURSE-C-${tag}`,
      courseCode: 'TST201',
      courseTitle: 'Synthetic Required ND II Course C',
      stageCode: 'ND_II',
      stageLabel: 'ND II',
      periodCode: 'FIRST_SEMESTER',
      periodLabel: 'First Semester',
      classification: 'COMPULSORY',
      legacyLevel: 'ND II',
      legacySemester: 'First Semester',
      creditUnits: 2,
    });
'@
    }
)

foreach ($item in $replacements) {
    $count = ([regex]::Matches($updated, [regex]::Escape($item.Old))).Count
    if ($count -ne 1) {
        throw "Safety stop: expected exactly one occurrence for '$($item.Name)', found $count. No files were changed."
    }
    $updated = $updated.Replace($item.Old, $item.New)
}

$backup = "$target.before-generalized-fixtures-$(Get-Date -Format 'yyyyMMdd-HHmmss').bak"
Copy-Item -LiteralPath $target -Destination $backup

try {
    Set-Content -LiteralPath $target -Value $updated -Encoding UTF8 -NoNewline
}
catch {
    Copy-Item -LiteralPath $backup -Destination $target -Force
    throw
}

Write-Host 'Temporary curriculum test fixtures updated successfully.'
Write-Host "Backup: $backup"
Write-Host 'Next check (read-only): npx tsc --noEmit'
Write-Host 'Do NOT run the temporary integration test; it targets a specific Neon test database and writes synthetic records.'
