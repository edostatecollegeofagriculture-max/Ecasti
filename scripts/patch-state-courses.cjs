/**
 * Patch the four mis-tagged courses inside ecasti_application_state.state
 * in Postgres, so the JSONB row matches the corrected JSON file.
 *
 * SAFETY:
 *   - Reads the row, finds each course by id in state.courses.
 *   - Updates only programmeId and departmentId for the four target courses.
 *   - Writes back as one UPDATE ... SET state = $1::jsonb.
 *   - Bumps revision by 1.
 *   - Refuses if any course is not found.
 *   - Default DRY-RUN; --apply required.
 */
const { Client } = require('pg');

const ALLOWED_DBS = new Set(['edocasti_pg', 'ecasti_staging_db']);

const FIXES = [
  { id: 'crs-com111', programmeId: 'prog-nd-cs',     departmentId: 'dept-cs' },
  { id: 'crs-com112', programmeId: 'prog-nd-cs',     departmentId: 'dept-cs' },
  { id: 'crs-slt111', programmeId: 'prog-nd-slt',    departmentId: 'dept-slt' },
  { id: 'crs-ahp111', programmeId: 'prog-nd-animal', departmentId: 'dept-animal' },
];

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('[FATAL] Refusing to run with NODE_ENV=production.');
    process.exit(1);
  }
  const apply = process.argv.includes('--apply');
  const url = process.env.EDOCASTI_LOCAL_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('[FATAL] Neither EDOCASTI_LOCAL_DATABASE_URL nor DATABASE_URL is set.');
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const idr = await client.query('SELECT current_database() AS db');
    const dbName = String(idr.rows[0].db);
    console.log('Target database:', dbName);
    if (!ALLOWED_DBS.has(dbName)) {
      console.error(`[FATAL] Database "${dbName}" not in allow-list.`);
      process.exit(1);
    }

    const r = await client.query(
      'SELECT state, revision FROM ecasti_application_state WHERE singleton_id = 1'
    );
    if (!r.rowCount) {
      console.error('[FATAL] ecasti_application_state row 1 not found.');
      process.exit(1);
    }
    console.log('Current revision:', r.rows[0].revision);

    const state = r.rows[0].state;
    if (!Array.isArray(state.courses)) {
      console.error('[FATAL] state.courses is not an array in the DB row.');
      process.exit(1);
    }

    const byId = new Map(state.courses.map((c) => [c.id, c]));
    const changes = [];
    for (const fix of FIXES) {
      const c = byId.get(fix.id);
      if (!c) {
        console.error(`[FATAL] Course "${fix.id}" not found in DB state.courses.`);
        process.exit(1);
      }
      const before = { programmeId: c.programmeId, departmentId: c.departmentId };
      const after = { programmeId: fix.programmeId, departmentId: fix.departmentId };
      if (before.programmeId === after.programmeId &&
          before.departmentId === after.departmentId) {
        console.log(`[skip] ${fix.id} already correct`);
        continue;
      }
      changes.push({ id: fix.id, before, after });
      c.programmeId = fix.programmeId;
      c.departmentId = fix.departmentId;
    }

    console.log('\n=== CHANGES ===');
    for (const c of changes) {
      console.log(`${c.id}`);
      console.log(`  programmeId : ${c.before.programmeId} -> ${c.after.programmeId}`);
      console.log(`  departmentId: ${c.before.departmentId} -> ${c.after.departmentId}`);
    }
    console.log(`\n${changes.length} course(s) to update in DB.`);

    if (changes.length === 0) {
      console.log('Nothing to do. Exiting.');
      return;
    }

    if (!apply) {
      console.log('\n=== DRY-RUN ===');
      console.log('No writes performed. Re-run with --apply to commit.');
      return;
    }

    await client.query('BEGIN');
    try {
      const upd = await client.query(
        `UPDATE ecasti_application_state
            SET state = $1::jsonb, revision = revision + 1, updated_at = NOW()
          WHERE singleton_id = 1
          RETURNING revision`,
        [JSON.stringify(state)]
      );
      await client.query('COMMIT');
      console.log('\nCommitted. New revision:', upd.rows[0].revision);
      console.log('Status: STATE_COURSES_PATCHED');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  } catch (e) {
    console.error('[FATAL]', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
main();