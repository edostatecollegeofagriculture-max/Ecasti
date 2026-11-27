import dotenv from 'dotenv';
import { Pool } from 'pg';

// .env is the single source of truth. `override: true` ensures a stale
// shell environment variable (e.g. from a prior `$env:DATABASE_URL = ...`)
// does not silently win over the file on disk.
dotenv.config({ override: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is missing. Check your local .env configuration.'
  );
}

export const neonPool = new Pool({
  connectionString,
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export async function testNeonConnection(): Promise<boolean> {
  const result = await neonPool.query('SELECT 1 AS connected');

  return result.rows[0]?.connected === 1;
}