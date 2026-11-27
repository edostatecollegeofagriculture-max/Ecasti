const { Client } = require('pg');

async function main() {
  const url = process.env.EDOCASTI_LOCAL_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) { console.error('No DATABASE_URL.'); process.exit(1); }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const r = await client.query(
      'SELECT pg_get_functiondef(oid) AS def FROM pg_proc WHERE proname = $1',
      ['validate_academic_curriculum_mapping_review']
    );
    if (!r.rowCount) { console.log('NOT FOUND'); return; }
    console.log(r.rows[0].def);
  } catch (e) {
    console.error('FAIL:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
main();