const { Client } = require('pg');

const dbName = process.argv[2];
if (!dbName) {
  console.error('Usage: node scripts/db-tables.cjs <database-name>');
  process.exit(1);
}

(async () => {
  const u = new URL(process.env.DATABASE_URL);
  const c = new Client({
    host: u.hostname,
    port: parseInt(u.port || '5432', 10),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: dbName,
  });
  try {
    await c.connect();
    const t = await c.query(
      "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log('Database:', dbName);
    console.log('Public tables:', t.rowCount);
    for (const r of t.rows) console.log('  -', r.table_schema + '.' + r.table_name);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})();