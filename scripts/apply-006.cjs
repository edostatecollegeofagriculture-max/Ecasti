/**
 * Apply database/migrations/006_academic_progression_foundation.sql
 * to the current DATABASE_URL target.
 *
 * SAFETY:
 *   - Refuses if NODE_ENV=production
 *   - Refuses if target DB is not in the allow-list
 *   - Refuses if migration 006 tables already exist (suggests DROP first)
 *   - Reads the .sql file, splits nothing — sends it as one multi-statement
 *     block; Postgres runs it in one implicit transaction
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MIGRATION_FILE = path.resolve(
  process.cwd(),
  'database',
  'migrations',
  '006_academic_progression_foundation.sql'
);
const ALLOWED_DBS = new Set(['edocasti_pg', 'ecasti_staging_db']);
const SENTINEL_TABLE = 'academic_curriculum_mappings';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('[FATAL] Refusing to run with NODE_ENV=production.');
    process.exit(1);
  }
  if (!fs.existsSync(MIGRATION_FILE)) {
    console.error('[FATAL] Migration file not found:', MIGRATION_FILE);
    process.exit(1);
  }

  const url = process.env.EDOCASTI_LOCAL_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('[FATAL] Neither EDOCASTI_LOCAL_DATABASE_URL nor DATABASE_URL is set.');
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const id = await client.query('SELECT current_database() AS db');
    const dbName = String(id.rows[0].db);
    console.log('Target database:', dbName);
    if (!ALLOWED_DBS.has(dbName)) {
      console.error(`[FATAL] Database "${dbName}" is not in the allow-list (${[...ALLOWED_DBS].join(', ')}).`);
      process.exit(1);
    }

    const existing = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1`,
      [SENTINEL_TABLE]
    );
    if (existing.rowCount) {
      console.log(`[ABORT] Table "${SENTINEL_TABLE}" already exists — migration 006 appears to be applied.`);
      console.log('       If you need to re-apply, DROP the academic tables manually first.');
      process.exit(2);
    }

    const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
    console.log('Migration file:', MIGRATION_FILE);
    console.log('File size:', sql.length, 'bytes');
    console.log('Executing...');

    await client.query(sql);

    const after = await client.query(
      `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`
    );
    console.log('Done. Public tables now:', after.rows[0].n);
    console.log('Status: MIGRATION_006_APPLIED');
  } catch (e) {
    console.error('[FATAL]', e.message);
    if (e.position) console.error('  at position', e.position);
    process.exit(1);
  } finally {
    await client.end();
  }
}
main();