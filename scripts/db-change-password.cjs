const { Client } = require('pg');

const newPassword = process.argv[2];
if (!newPassword) {
  console.error('Usage: node scripts/db-change-password.cjs <new-password>');
  process.exit(1);
}
if (!/^[A-Za-z0-9_-]+$/.test(newPassword)) {
  console.error('Refusing: password must be alphanumeric plus _ and - only (no @ : / ? # or spaces).');
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
    // Escape single quotes (defensive — our allowlist above already prevents them).
    const escaped = newPassword.replace(/'/g, "''");
    await c.query("ALTER USER postgres WITH PASSWORD '" + escaped + "'");
    console.log('Password changed for user postgres.');
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})();