#requires -Version 5.1
$ErrorActionPreference = "Stop"

$dbPath     = ".\server\db.ts"
$backupDir  = ".\_backups\db-ts-edits"
$stamp      = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $backupDir "db.ts.$stamp.bak"

if (-not (Test-Path $dbPath)) { throw "Not found: $dbPath" }

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Copy-Item $dbPath $backupPath
$origHash = (Get-FileHash $dbPath -Algorithm SHA256).Hash
Write-Host "Backup: $backupPath"
Write-Host "Original SHA256: $origHash"

# Read raw bytes; detect BOM and line endings; decode as UTF-8.
$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $dbPath))
$hasBOM = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
$text   = [System.Text.Encoding]::UTF8.GetString($bytes)
if ($hasBOM) { $text = $text.TrimStart([char]0xFEFF) }
$usesCRLF = $text.Contains("`r`n")
$nl = if ($usesCRLF) { "`r`n" } else { "`n" }
Write-Host ("BOM: " + $hasBOM + "  Line endings: " + $(if ($usesCRLF) {"CRLF"} else {"LF"}))

# Locate anchor: the line `if (!STAGING_DEMO_ONLY) return;` immediately after
# `public async initializePersistentStore()`. Must appear EXACTLY ONCE.
$methodPattern = 'public\s+async\s+initializePersistentStore\s*\(\s*\)\s*:\s*Promise<void>\s*\{'
$guardPattern  = 'if\s*\(\s*!STAGING_DEMO_ONLY\s*\)\s*return\s*;'

$methodMatches = [regex]::Matches($text, $methodPattern)
if ($methodMatches.Count -ne 1) {
  throw "Expected exactly one initializePersistentStore declaration, found $($methodMatches.Count). Aborting."
}
$methodIdx = $methodMatches[0].Index
$methodEnd = $methodIdx + $methodMatches[0].Length

$afterMethod = $text.Substring($methodEnd)
$guardMatch  = [regex]::Match($afterMethod, $guardPattern)
if (-not $guardMatch.Success) { throw "Could not find '!STAGING_DEMO_ONLY' guard inside initializePersistentStore. Aborting." }

# Only whitespace allowed between method open and guard.
$between = $afterMethod.Substring(0, $guardMatch.Index)
if ($between.Trim().Length -ne 0) {
  $preview = $between.Trim()
  if ($preview.Length -gt 120) { $preview = $preview.Substring(0,120) }
  throw ("Non-whitespace content found between method declaration and STAGING_DEMO_ONLY guard. " +
         "Refusing to inject. Content: [" + $preview + "]")
}

# Idempotency: refuse if edit is already applied.
$localMarker = 'EDOCASTI_USE_POSTGRES_STATE'
if ($text.Contains($localMarker)) {
  throw "Marker '$localMarker' already present. Edit appears to already be applied. Aborting."
}

# Build injection block using file's line ending.
$injectionLines = @(
  "    const LOCAL_POSTGRES_STATE = process.env.EDOCASTI_USE_POSTGRES_STATE === 'true';",
  "    if (!STAGING_DEMO_ONLY && !LOCAL_POSTGRES_STATE) return;",
  "",
  "    if (LOCAL_POSTGRES_STATE && !STAGING_DEMO_ONLY) {",
  "      const { neonPool } = await import('./neon');",
  "      const client = await neonPool.connect();",
  "      try {",
  "        await client.query('BEGIN');",
  "        await client.query(`",
  "          CREATE TABLE IF NOT EXISTS ecasti_application_state (",
  "            singleton_id SMALLINT PRIMARY KEY CHECK (singleton_id = 1),",
  "            state JSONB NOT NULL,",
  "            revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),",
  "            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
  "          )",
  "        `);",
  "        await client.query(""SELECT pg_advisory_xact_lock(hashtext('ecasti-json-state-v2'))"");",
  "        const stored = await client.query('SELECT state FROM ecasti_application_state WHERE singleton_id = 1');",
  "        if (stored.rowCount === 1) {",
  "          this.state = stored.rows[0].state as DatabaseState;",
  "          console.log('[EDOCASTI] loaded durable application state from PostgreSQL.');",
  "        } else {",
  "          await client.query(",
  '            ''INSERT INTO ecasti_application_state (singleton_id, state) VALUES (1, $1::jsonb)'',',
  "            [JSON.stringify(this.state)]",
  "          );",
  "          console.log('[EDOCASTI] initialized PostgreSQL from current in-memory state.');",
  "        }",
  "        await client.query('COMMIT');",
  "        this.persistentClient = client;",
  "        return;",
  "      } catch (err) {",
  "        await client.query('ROLLBACK').catch(() => {});",
  "        client.release();",
  "        throw err;",
  "      }",
  "    }",
  ""
)
$injection = ($injectionLines -join $nl)

# Compute new content: keep up to method open, then injection, skip original guard line.
$guardAbsStart = $methodEnd + $guardMatch.Index
$guardAbsEnd   = $guardAbsStart + $guardMatch.Length

$restAfterGuard = $text.Substring($guardAbsEnd)
if ($restAfterGuard.StartsWith("`r`n")) {
  $restAfterGuard = $restAfterGuard.Substring(2)
} elseif ($restAfterGuard.StartsWith("`n")) {
  $restAfterGuard = $restAfterGuard.Substring(1)
}

$newText = $text.Substring(0, $methodEnd) + $nl + $injection + $restAfterGuard

# Write UTF-8 without BOM.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $dbPath), $newText, $utf8NoBom)

# Verify post-write; restore backup on any failure.
function Restore-AndThrow($msg) {
  Copy-Item $backupPath $dbPath -Force
  throw ($msg + " Backup restored from: " + $backupPath)
}

$newHash = (Get-FileHash $dbPath -Algorithm SHA256).Hash
if ($newHash -eq $origHash) { Restore-AndThrow "No change occurred after write." }

$verifyBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $dbPath))
if ($verifyBytes.Length -ge 3 -and $verifyBytes[0] -eq 0xEF -and $verifyBytes[1] -eq 0xBB -and $verifyBytes[2] -eq 0xBF) {
  Restore-AndThrow "Written file has UTF-8 BOM."
}

$verifyText = [System.Text.Encoding]::UTF8.GetString($verifyBytes)
$markerCount = ([regex]::Matches($verifyText, [regex]::Escape($localMarker))).Count
if ($markerCount -ne 1) { Restore-AndThrow "Marker count is $markerCount (expected 1)." }

$guardCount = ([regex]::Matches($verifyText, $guardPattern)).Count
if ($guardCount -ne 0) { Restore-AndThrow "Original guard still present ($guardCount occurrences)." }

Write-Host ""
Write-Host "=== EDIT APPLIED ==="
Write-Host "Backup:          $backupPath"
Write-Host "Original SHA256: $origHash"
Write-Host "New SHA256:      $newHash"
Write-Host "Marker count:    $markerCount"
Write-Host "Guard removed:   YES"
Write-Host ""
Write-Host "If tsc fails, restore with:"
Write-Host "  Copy-Item '$backupPath' '.\server\db.ts' -Force"