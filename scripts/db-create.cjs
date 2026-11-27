const { Client } = require('pg');

const dbName = process.argv[2];
if (!dbName) {
  console.error('Usage: node scripts/db-create.cjs <database-name>');
  process.exit(1);
}
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName)) {
  console.error('Refusing: database name must be a simple identifier.');
  process.exit(1);
}

(async () => {
  const u = new URL(process.env.DATABASE_URL);
  const c = new Client({
    host: u.hostname,
    port: parseInt(u.port || '5432', 10),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: 'postgres',
  });
  try {
    await c.connect();
    const existing = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (existing.rowCount) {
      console.log('Database "' + dbName + '" already exists.');
    } else {
      await c.query('CREATE DATABASE ' + dbName);
      console.log('Created database "' + dbName + '".');
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})();