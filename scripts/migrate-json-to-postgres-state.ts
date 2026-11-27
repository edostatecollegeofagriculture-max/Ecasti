/**
 * One-time migration: JSON state file -> Postgres JSONB envelope.
 *
 * SAFETY:
 *   - Reads data/edocasti_db.json READ-ONLY (SHA256 before + after must match).
 *   - Refuses if NODE_ENV=production.
 *   - Refuses if target DB name is not explicitly allow-listed.
 *   - Default is DRY-RUN. Requires --apply to write.
 *   - Refuses to overwrite an existing row unless --replace is passed.
 *   - Runs in a single transaction; any failure rolls back completely.
 *   - Uses canonical (key-sorted) comparison because Postgres jsonb does not
 *     preserve object key insertion order.
 *
 * USAGE:
 *   npx tsx scripts/migrate-json-to-postgres-state.ts            (dry-run)
 *   npx tsx scripts/migrate-json-to-postgres-state.ts --apply    (commit)
 *   npx tsx scripts/migrate-json-to-postgres-state.ts --apply --replace
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Client } from 'pg';

const ALLOWED_DB_NAMES = new Set(['edocasti_pg', 'ecasti_staging_db']);
const DB_FILE = path.resolve(process.cwd(), 'data', 'edocasti_db.json');

function fail(msg: string): never {
  console.error(`[FATAL] ${msg}`);
  process.exit(1);
}

function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function countCollections(state: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  let total = 0;
  for (const [k, v] of Object.entries(state)) {
    if (Array.isArray(v)) { out[k] = v.length; total += v.length; }
    else if (v && typeof v === 'object') { out[k] = 1; total += 1; }
  }
  out.__total = total;
  return out;
}

function canonicalize(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === 'object') {
    const src = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src).sort()) {
      out[key] = canonicalize(src[key]);
    }
    return out;
  }
  return v;
}

function canonString(v: unknown): string {
  return JSON.stringify(canonicalize(v));
}

async function main() {
  if (process.env.NODE_ENV === 'production') fail('Refusing to run with NODE_ENV=production.');

  const apply = process.argv.includes('--apply');
  const replace = process.argv.includes('--replace');
  const url = process.env.EDOCASTI_LOCAL_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) fail('Neither EDOCASTI_LOCAL_DATABASE_URL nor DATABASE_URL is set.');

  if (!fs.existsSync(DB_FILE)) fail(`Source file not found: ${DB_FILE}`);
  const sourceBuf = fs.readFileSync(DB_FILE);
  const sourceHash = sha256(sourceBuf);
  const sourceState = JSON.parse(sourceBuf.toString('utf-8')) as Record<string, unknown>;
  const sourceCounts = countCollections(sourceState);

  console.log('=== SOURCE ===');
  console.log(`File:   ${DB_FILE}`);
  console.log(`SHA256: ${sourceHash}`);
  console.log(`Records: ${sourceCounts.__total}`);
  for (const [k, n] of Object.entries(sourceCounts)) {
    if (k !== '__total') console.log(`  ${k.padEnd(28)} ${n}`);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const idRes = await client.query('SELECT current_database() AS db');
    const dbName = String(idRes.rows[0].db);
    console.log(`\n=== TARGET ===\nDatabase: ${dbName}`);
    if (!ALLOWED_DB_NAMES.has(dbName)) {
      fail(`Target database "${dbName}" is not in the allow-list (${[...ALLOWED_DB_NAMES].join(', ')}).`);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS ecasti_application_state (
        singleton_id SMALLINT PRIMARY KEY CHECK (singleton_id = 1),
        state JSONB NOT NULL,
        revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const existing = await client.query(
      'SELECT revision, updated_at FROM ecasti_application_state WHERE singleton_id = 1'
    );

    if (existing.rowCount && !replace) {
      fail(`Row already exists (revision ${existing.rows[0].revision}). Pass --replace to overwrite.`);
    }

    if (!apply) {
      console.log('\n=== DRY-RUN ===');
      console.log(existing.rowCount
        ? `Would REPLACE existing row (current revision ${existing.rows[0].revision}).`
        : 'Would INSERT initial row.');
      console.log('Re-run with --apply to commit.');
      return;
    }

    await client.query('BEGIN');
    try {
      if (existing.rowCount) {
        await client.query(
          'UPDATE ecasti_application_state SET state = $1::jsonb, revision = revision + 1, updated_at = NOW() WHERE singleton_id = 1',
          [JSON.stringify(sourceState)]
        );
      } else {
        await client.query(
          'INSERT INTO ecasti_application_state (singleton_id, state) VALUES (1, $1::jsonb)',
          [JSON.stringify(sourceState)]
        );
      }

      const readBack = await client.query(
        'SELECT state, revision FROM ecasti_application_state WHERE singleton_id = 1'
      );
      const stored = readBack.rows[0].state as Record<string, unknown>;
      const storedCounts = countCollections(stored);

      const mismatches = Object.keys(sourceCounts).filter(
        (k) => sourceCounts[k] !== storedCounts[k]
      );
      if (mismatches.length) {
        throw new Error(`Record count mismatch after write: ${mismatches.join(', ')}`);
      }

      // Canonical comparison: jsonb does not preserve object key order.
      const srcCanon = canonString(sourceState);
      const dstCanon = canonString(stored);
      if (srcCanon !== dstCanon) {
        // Report first differing region for diagnosis without dumping values.
        const minLen = Math.min(srcCanon.length, dstCanon.length);
        let diffAt = -1;
        for (let i = 0; i < minLen; i++) {
          if (srcCanon[i] !== dstCanon[i]) { diffAt = i; break; }
        }
        if (diffAt < 0 && srcCanon.length !== dstCanon.length) diffAt = minLen;
        const ctx = diffAt >= 0
          ? ` first difference at offset ${diffAt}: source=` +
            JSON.stringify(srcCanon.slice(diffAt, diffAt + 40)) +
            ` stored=` +
            JSON.stringify(dstCanon.slice(diffAt, diffAt + 40))
          : '';
        throw new Error('Stored JSON does not match source JSON after canonicalization.' + ctx);
      }

      await client.query('COMMIT');
      console.log(`\n=== COMMITTED ===`);
      console.log(`New revision: ${readBack.rows[0].revision}`);
      console.log(`Stored records match source: YES`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  } finally {
    await client.end();
  }

  const afterBuf = fs.readFileSync(DB_FILE);
  if (sha256(afterBuf) !== sourceHash) fail('Source JSON changed during migration — abort.');
  console.log('Source JSON SHA256 unchanged: YES');
  console.log('Status: MIGRATION_COMPLETE');
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));