const { Client } = require('pg');

const newPassword = process.argv[2];
if (!newPassword) {
  console.error('Usage: node scripts/db-change-password-direct.cjs <new-password>');
  process.exit(1);
}
if (!/^[A-Za-z0-9_-]+$/.test(newPassword)) {
  console.error('Refusing: password must be alphanumeric plus _ and - only.');
  process.exit(1);
}

(async () => {
  const c = new Client({
    host: '127.0.0.1',
    port: 5433,
    user: 'postgres',
    password: process.env.PGPASSWORD || 'Frankie@83',
    database: 'postgres',
  });
  try {
    await c.connect();
    await c.query("ALTER USER postgres WITH PASSWORD '" + newPassword + "'");
    console.log('Password changed for user postgres.');
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})();