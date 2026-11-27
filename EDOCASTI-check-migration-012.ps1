
$ErrorActionPreference = 'Stop'

$projectRoot = 'C:\Users\EDSG-JOOPSA\Documents\EDOCASTI-LOCAL'
$reportFile = Join-Path $projectRoot (
    'migration-012-precheck-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.txt'
)

Write-Host "`nEDOCASTI migration 012 - LOCAL DATABASE PRE-CHECK" -ForegroundColor Cyan
Write-Host "Target: 127.0.0.1:5433 / ecasti_local"
Write-Host "Read-only checks only. No migration will be executed.`n"

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    throw 'psql was not found. Ensure PostgreSQL bin is on PATH.'
}

$existenceSql = @'
SELECT
    to_regclass('public.academic_curriculum_mapping_courses') IS NOT NULL
    AND
    to_regclass('public.student_academic_required_courses') IS NOT NULL;
'@

$exists = & psql -X -h 127.0.0.1 -p 5433 -d ecasti_local -t -A -c $existenceSql

if ($LASTEXITCODE -ne 0) {
    throw 'Could not connect to the local database. Check PostgreSQL and your local login.'
}

if ($exists.Trim() -ne 't') {
    throw 'One or both required tables are missing. Confirm migration 006 is applied locally.'
}

$checkSql = @'
\pset pager off
\echo
\echo ===== LEGACY NULL VALUE CHECK =====

SELECT
    'academic_curriculum_mapping_courses' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (
        WHERE course_level_snapshot IS NULL
           OR semester_snapshot IS NULL
    ) AS rows_with_null_legacy_values
FROM public.academic_curriculum_mapping_courses

UNION ALL

SELECT
    'student_academic_required_courses',
    COUNT(*),
    COUNT(*) FILTER (
        WHERE course_level_snapshot IS NULL
           OR semester_snapshot IS NULL
    )
FROM public.student_academic_required_courses;

\echo
\echo ===== EXISTING CONSTRAINTS =====

SELECT
    c.relname AS table_name,
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
      'academic_curriculum_mapping_courses',
      'student_academic_required_courses'
  )
ORDER BY c.relname, con.conname;

\echo
\echo ===== EXISTING INDEXES =====

SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
      'academic_curriculum_mapping_courses',
      'student_academic_required_courses'
  )
ORDER BY tablename, indexname;
'@

Write-Host 'Running read-only checks...' -ForegroundColor Yellow

$output = & psql -X -h 127.0.0.1 -p 5433 -d ecasti_local -v ON_ERROR_STOP=1 -c $checkSql 2>&1
$exitCode = $LASTEXITCODE

$output | Tee-Object -FilePath $reportFile

if ($exitCode -ne 0) {
    throw 'The database checks failed. Review the output above.'
}

Write-Host "`nPre-check completed." -ForegroundColor Green
Write-Host "Report saved to: $reportFile"
Write-Host 'No database records, schema, or migration files were changed.'
