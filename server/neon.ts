
import 'dotenv/config';
import { Pool } from 'pg';

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
