$ErrorActionPreference = "Stop"

$Psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$DraftPath = (Resolve-Path ".\database\migrations\010_core_entities_and_legacy_finance_RERUN_SAFE_REVIEW.sql").Path

if (!(Test-Path $Psql)) {
    throw "PostgreSQL 18 psql.exe was not found at the expected location."
}

if (!(Test-Path $DraftPath)) {
    throw "Migration review draft was not found."
}

$stamp = Get-Date -Format "yyyyMMddHHmmss"
$dbFresh = "ecasti_mig010_fresh_$stamp"
$dbMismatch = "ecasti_mig010_mismatch_$stamp"
$dbRollback = "ecasti_mig010_rollback_$stamp"

$tables = @(
    "schools", "users", "departments", "programmes", "courses",
    "admission_applications", "students", "legacy_invoices",
    "legacy_payment_transactions"
)

$foreignKeys = @(
    "fk_users_department",
    "fk_users_school",
    "fk_schools_dean",
    "fk_departments_hod",
    "fk_courses_lecturer"
)

$draft = Get-Content -Raw $DraftPath

$indexNames = @(
    [regex]::Matches(
        $draft,
        '(?im)^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+([A-Za-z_][A-Za-z0-9_]*)'
    ) | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
)

if ($indexNames.Count -ne 14) {
    throw "Expected 14 declared indexes; found $($indexNames.Count). Stop for review."
}

$securePassword = Read-Host "Enter the LOCAL PostgreSQL postgres-role password" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

function Invoke-Psql {
    param(
        [string]$Database,
        [string[]]$PsqlArgs
    )

    & $Psql -X -v ON_ERROR_STOP=1 `
        -h 127.0.0.1 -p 5433 -U postgres -d $Database @PsqlArgs

    if ($LASTEXITCODE -ne 0) {
        throw "psql failed while working with database '$Database'."
    }
}

function Get-PsqlScalar {
    param(
        [string]$Database,
        [string]$Sql
    )

    $result = & $Psql -X -A -t -q -v ON_ERROR_STOP=1 `
        -h 127.0.0.1 -p 5433 -U postgres -d $Database -c $Sql

    if ($LASTEXITCODE -ne 0) {
        throw "Read-only verification query failed on '$Database'."
    }

    return (($result | Out-String).Trim())
}

function New-DisposableDatabase {
    param([string]$Name)

    $exists = Get-PsqlScalar -Database "postgres" -Sql `
        "SELECT count(*) FROM pg_database WHERE datname = '$Name';"

    if ($exists -ne "0") {
        throw "Database '$Name' already exists. Refusing to reuse it."
    }

    Invoke-Psql -Database "postgres" -PsqlArgs @("-c", "CREATE DATABASE $Name;")
    Write-Host "Created disposable database: $Name"
}

function Assert-LocalDatabaseIdentity {
    param([string]$Database)

    $identity = Get-PsqlScalar -Database $Database -Sql `
        "SELECT current_database() || '|' || COALESCE(inet_server_addr()::text,'') || '|' || inet_server_port();"

    if ($identity -notmatch "^$([regex]::Escape($Database))\|127\.0\.0\.1/32\|5433$") {
        throw "Database identity verification failed for '$Database': $identity"
    }
}

function Get-SchemaCounts {
    param([string]$Database)

    $tableList = ($tables | ForEach-Object { "'$_'" }) -join ","
    $fkList = ($foreignKeys | ForEach-Object { "'$_'" }) -join ","
    $indexList = ($indexNames | ForEach-Object { "'$_'" }) -join ","

    $tableCount = Get-PsqlScalar -Database $Database -Sql `
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ($tableList);"

    $fkCount = Get-PsqlScalar -Database $Database -Sql `
        "SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='f' AND conname IN ($fkList) AND pg_get_constraintdef(oid) ILIKE '%ON DELETE RESTRICT%';"

    $indexCount = Get-PsqlScalar -Database $Database -Sql `
        "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname IN ($indexList);"

    return @{
        Tables = [int]$tableCount
        ForeignKeys = [int]$fkCount
        Indexes = [int]$indexCount
    }
}

try {
    Write-Host "`n=== TEST 1: FRESH APPLICATION AND REPEAT ==="

    New-DisposableDatabase $dbFresh
    Assert-LocalDatabaseIdentity $dbFresh

    Invoke-Psql -Database $dbFresh -PsqlArgs @("-f", $DraftPath)
    Write-Host "First application completed."

    $first = Get-SchemaCounts $dbFresh

    if ($first.Tables -ne 9 -or $first.ForeignKeys -ne 5 -or $first.Indexes -ne 14) {
        throw "First application did not produce the expected schema counts."
    }

    Invoke-Psql -Database $dbFresh -PsqlArgs @("-f", $DraftPath)
    Write-Host "Second application completed."

    $second = Get-SchemaCounts $dbFresh

    if ($second.Tables -ne 9 -or $second.ForeignKeys -ne 5 -or $second.Indexes -ne 14) {
        throw "Repeat application changed or lost expected schema objects."
    }

    Write-Host "TEST 1 PASS: Fresh and repeat application."

    Write-Host "`n=== TEST 2: MISMATCHED CONSTRAINT REJECTION ==="

    New-DisposableDatabase $dbMismatch
    Assert-LocalDatabaseIdentity $dbMismatch

    Invoke-Psql -Database $dbMismatch -PsqlArgs @("-f", $DraftPath)

    Invoke-Psql -Database $dbMismatch -PsqlArgs @(
        "-c",
        "ALTER TABLE public.users DROP CONSTRAINT fk_users_department; ALTER TABLE public.users ADD CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES public.schools(id) ON DELETE CASCADE;"
    )

    $mismatchOutput = & $Psql -X -v ON_ERROR_STOP=1 `
        -h 127.0.0.1 -p 5433 -U postgres -d $dbMismatch `
        -f $DraftPath 2>&1

    $mismatchExit = $LASTEXITCODE
    $mismatchText = $mismatchOutput -join "`n"

    if ($mismatchExit -eq 0) {
        throw "Mismatched constraint was incorrectly accepted."
    }

    if ($mismatchText -notmatch "different definition") {
        throw "Migration failed, but not for the expected mismatch reason: $mismatchText"
    }

    $remainingDefinition = Get-PsqlScalar -Database $dbMismatch -Sql `
        "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.users'::regclass AND conname='fk_users_department';"

    if ($remainingDefinition -notmatch "ON DELETE CASCADE") {
        throw "Mismatch test did not preserve the deliberately mismatched constraint."
    }

    Write-Host "TEST 2 PASS: Mismatched constraint rejected; existing constraint preserved."

    Write-Host "`n=== TEST 3: TRANSACTION ROLLBACK ==="

    New-DisposableDatabase $dbRollback
    Assert-LocalDatabaseIdentity $dbRollback

    $commitPattern = [regex]::new("(?im)^\s*COMMIT\s*;")
    if ($commitPattern.Matches($draft).Count -ne 1) {
        throw "Expected exactly one COMMIT marker in the review draft."
    }

    $rollbackSql = $commitPattern.Replace(
        $draft,
        "SELECT 1 / 0;`r`nCOMMIT;",
        1
    )

    $rollbackFile = Join-Path $env:TEMP "ecasti_migration010_rollback_test_$stamp.sql"
    Set-Content -Path $rollbackFile -Value $rollbackSql -Encoding UTF8

    try {
        $rollbackOutput = & $Psql -X -v ON_ERROR_STOP=1 `
            -h 127.0.0.1 -p 5433 -U postgres -d $dbRollback `
            -f $rollbackFile 2>&1

        $rollbackExit = $LASTEXITCODE

        if ($rollbackExit -eq 0) {
            throw "Controlled rollback test unexpectedly succeeded."
        }

        $remainingTables = Get-PsqlScalar -Database $dbRollback -Sql `
            "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ($((($tables | ForEach-Object { "'$_'" }) -join ',')));"

        if ($remainingTables -ne "0") {
            throw "Rollback test left $remainingTables target tables behind."
        }
    }
    finally {
        if (Test-Path $rollbackFile) {
            Remove-Item $rollbackFile -Force
        }
    }

    Write-Host "TEST 3 PASS: Failed transaction left no target tables."

    $report = [ordered]@{
        mode = "LOCAL_DISPOSABLE_POSTGRESQL_TESTS"
        server = "127.0.0.1:5433"
        databases = @{
            freshRepeat = $dbFresh
            mismatch = $dbMismatch
            rollback = $dbRollback
        }
        freshApplication = @{
            tables = $first.Tables
            foreignKeys = $first.ForeignKeys
            indexes = $first.Indexes
            repeatApplication = "PASS"
        }
        mismatchConstraintTest = "PASS"
        rollbackTest = "PASS"
        originalLocalDatabaseTouched = $false
        stagingDatabaseTouched = $false
        sourceJsonModified = $false
        databasesAutomaticallyDropped = $false
    }

    $reportPath = Join-Path (Get-Location) "EDOCASTI_Migration_010_Disposable_Test_Results.json"
    $report | ConvertTo-Json -Depth 6 | Set-Content $reportPath -Encoding UTF8

    Write-Host "`nALL THREE TESTS PASSED"
    Write-Host "Results: $reportPath"
    Write-Host "Disposable databases retained for inspection:"
    Write-Host "  $dbFresh"
    Write-Host "  $dbMismatch"
    Write-Host "  $dbRollback"
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
