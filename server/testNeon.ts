import { neonPool, testNeonConnection } from './neon';

async function main() {
  try {
    const connected = await testNeonConnection();

    if (!connected) {
      throw new Error('Unexpected connection test result.');
    }

    console.log('[SUCCESS] Neon PostgreSQL connection verified.');
    console.log('[SAFE] Only a read-only SELECT 1 query was executed.');
  } catch {
    console.error(
      '[FAILED] Could not connect to Neon. Check your local DATABASE_URL and network connection.'
    );
    process.exitCode = 1;
  } finally {
    await neonPool.end();
  }
}

main();
