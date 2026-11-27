
$ErrorActionPreference = 'Stop'

$projectRoot = 'C:\Users\EDSG-JOOPSA\Documents\EDOCASTI-LOCAL'

$files = @(
    (Join-Path $projectRoot '012_generalized_curriculum_mapping_REVIEW_DRAFT.sql')
    (Join-Path $projectRoot '012_generalized_curriculum_mapping_REVIEW_DRAFT (1).sql')
)

# Confirm both files exist.
foreach ($file in $files) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "Safety stop: required draft file not found: $file"
    }
}

# Confirm the original drafts are identical.
$originalHashes = @(
    $files | ForEach-Object {
        (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash
    } | Select-Object -Unique
)

if ($originalHashes.Count -ne 1) {
    throw 'Safety stop: the two SQL drafts are not identical. No files were changed.'
}

$oldBlock = @'
ALTER TABLE student_academic_required_courses
    DROP CONSTRAINT IF EXISTS student_academic_required_courses_course_level_snapshot_check,
    DROP CONSTRAINT IF EXISTS student_academic_required_courses_semester_snapshot_check;

ALTER TABLE student_academic_required_courses
    ALTER COLUMN course_level_snapshot DROP NOT NULL,
    ALTER COLUMN semester_snapshot DROP NOT NULL;

    ADD CONSTRAINT chk_student_required_classification
        CHECK (
            classification_snapshot IS NULL
            OR classification_snapshot = 'COMPULSORY'
        ),
    ADD CONSTRAINT chk_student_required_generic_snapshot_values
        CHECK (
            (
                stage_code_snapshot IS NULL
                AND stage_label_snapshot IS NULL
                AND period_code_snapshot IS NULL
                AND period_label_snapshot IS NULL
                AND classification_snapshot IS NULL
            )
            OR
            (
                stage_code_snapshot IS NOT NULL
                AND LENGTH(TRIM(stage_code_snapshot)) > 0
                AND stage_label_snapshot IS NOT NULL
                AND LENGTH(TRIM(stage_label_snapshot)) > 0
                AND period_code_snapshot IS NOT NULL
                AND LENGTH(TRIM(period_code_snapshot)) > 0
                AND period_label_snapshot IS NOT NULL
                AND LENGTH(TRIM(period_label_snapshot)) > 0
                AND classification_snapshot = 'COMPULSORY'
            )
        );
'@

$newBlock = @'
ALTER TABLE student_academic_required_courses
    DROP CONSTRAINT IF EXISTS student_academic_required_courses_course_level_snapshot_check,
    DROP CONSTRAINT IF EXISTS student_academic_required_courses_semester_snapshot_check,
    ALTER COLUMN course_level_snapshot DROP NOT NULL,
    ALTER COLUMN semester_snapshot DROP NOT NULL,
    ADD CONSTRAINT chk_student_required_classification
        CHECK (
            classification_snapshot IS NULL
            OR classification_snapshot = 'COMPULSORY'
        ),
    ADD CONSTRAINT chk_student_required_generic_snapshot_values
        CHECK (
            (
                stage_code_snapshot IS NULL
                AND stage_label_snapshot IS NULL
                AND period_code_snapshot IS NULL
                AND period_label_snapshot IS NULL
                AND classification_snapshot IS NULL
            )
            OR
            (
                stage_code_snapshot IS NOT NULL
                AND LENGTH(TRIM(stage_code_snapshot)) > 0
                AND stage_label_snapshot IS NOT NULL
                AND LENGTH(TRIM(stage_label_snapshot)) > 0
                AND period_code_snapshot IS NOT NULL
                AND LENGTH(TRIM(period_code_snapshot)) > 0
                AND period_label_snapshot IS NOT NULL
                AND LENGTH(TRIM(period_label_snapshot)) > 0
                AND classification_snapshot = 'COMPULSORY'
            )
        );
'@

# Normalize the search blocks so CRLF and LF line endings both match.
$oldNormalized = ($oldBlock -replace "`r`n", "`n" -replace "`r", "`n").TrimEnd([char[]]"`r`n")
$newNormalized = ($newBlock -replace "`r`n", "`n" -replace "`r", "`n").TrimEnd([char[]]"`r`n")

$updatedContents = @{}

# Validate BOTH files completely before writing either one.
foreach ($file in $files) {
    $original = [System.IO.File]::ReadAllText($file)
    $normalized = $original -replace "`r`n", "`n" -replace "`r", "`n"

    $matchCount = [regex]::Matches(
        $normalized,
        [regex]::Escape($oldNormalized)
    ).Count

    if ($matchCount -ne 1) {
        throw "Safety stop: expected exactly one malformed section in '$file'; found $matchCount. No files were changed."
    }

    $patched = $normalized.Replace($oldNormalized, $newNormalized)

    # Preserve the original file's newline convention.
    if ($original.Contains("`r`n")) {
        $patched = $patched.Replace("`n", "`r`n")
    }

    $updatedContents[$file] = $patched
}

# Back up both originals before changing either file.
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backups = @()

foreach ($file in $files) {
    $backup = "$file.before-alter-table-syntax-fix-$stamp.bak"
    Copy-Item -LiteralPath $file -Destination $backup
    $backups += $backup
}

try {
    foreach ($file in $files) {
        [System.IO.File]::WriteAllText(
            $file,
            $updatedContents[$file],
            [System.Text.UTF8Encoding]::new($false)
        )
    }

    # Verify both updated drafts are identical.
    $patchedHashes = @(
        $files | ForEach-Object {
            (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash
        } | Select-Object -Unique
    )

    if ($patchedHashes.Count -ne 1) {
        throw 'Verification failed: the patched drafts are not identical.'
    }

    # Verify the malformed block is gone and the corrected block is present.
    foreach ($file in $files) {
        $check = [System.IO.File]::ReadAllText($file)
        $checkNormalized = $check -replace "`r`n", "`n" -replace "`r", "`n"

        if ($checkNormalized.Contains($oldNormalized)) {
            throw "Verification failed: malformed block remains in '$file'."
        }

        if (-not $checkNormalized.Contains($newNormalized)) {
            throw "Verification failed: corrected block was not found in '$file'."
        }
    }
}
catch {
    # Restore both originals if writing or verification fails.
    for ($i = 0; $i -lt $files.Count; $i++) {
        if (Test-Path -LiteralPath $backups[$i]) {
            Copy-Item -LiteralPath $backups[$i] -Destination $files[$i] -Force
        }
    }

    throw "Repair failed. Original drafts restored from backups. Details: $($_.Exception.Message)"
}

Write-Host ''
Write-Host 'SUCCESS: both SQL review drafts have been repaired and verified.' -ForegroundColor Green
Write-Host 'The two patched files have matching SHA256 hashes.'
Write-Host 'No database was connected to or modified.'
Write-Host ''
Write-Host 'Updated files:'
$files | ForEach-Object { Write-Host "  $_" }
Write-Host ''
Write-Host 'Original backups:'
$backups | ForEach-Object { Write-Host "  $_" }
Write-Host ''
Write-Host 'Do not execute the SQL yet. The migration still needs review.'
