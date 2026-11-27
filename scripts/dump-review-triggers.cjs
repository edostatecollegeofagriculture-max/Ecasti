const { Client } = require('pg');

async function main() {
  const url = process.env.EDOCASTI_LOCAL_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('[FATAL] No DATABASE_URL.');
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const r = await client.query(`
      SELECT p.proname, pg_get_functiondef(p.oid) AS def
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname LIKE '%review%'
       ORDER BY p.proname
    `);
    console.log('Functions matching %review%:', r.rowCount);
    for (const row of r.rows) {
      console.log('\n=== ' + row.proname + ' ===');
      console.log(row.def);
    }

    const t = await client.query(`
      SELECT tgname, tgrelid::regclass AS tbl, tgfoid::regproc AS fn
        FROM pg_trigger
       WHERE NOT tgisinternal
         AND tgrelid::regclass::text LIKE '%review%'
       ORDER BY tgrelid::regclass::text, tgname
    `);
    console.log('\n=== Triggers on review tables ===');
    for (const row of t.rows) {
      console.log(`${row.tbl} | ${row.tgname} -> ${row.fn}`);
    }
  } catch (e) {
    console.error('[FATAL]', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
main();