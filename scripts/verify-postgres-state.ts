/**
 * Read-only verification that ecasti_application_state matches
 * data/edocasti_db.json semantically (key-order-insensitive).
 * Writes nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Client } from 'pg';

const DB_FILE = path.resolve(process.cwd(), 'data', 'edocasti_db.json');

function sha(b: Buffer) { return crypto.createHash('sha256').update(b).digest('hex'); }

function canonicalize(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === 'object') {
    const src = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src).sort()) {
      out[key] = canonicalize(src[key]);
    }
    return out;
  }
  return v;
}

function canonString(v: unknown): string {
  return JSON.stringify(canonicalize(v));
}

async function main() {
  const url = process.env.EDOCASTI_LOCAL_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('No DATABASE_URL / EDOCASTI_LOCAL_DATABASE_URL set.');

  const src = fs.readFileSync(DB_FILE);
  const srcHash = sha(src);
  const srcState = JSON.parse(src.toString('utf-8'));

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const r = await client.query('SELECT state, revision, updated_at FROM ecasti_application_state WHERE singleton_id = 1');
    if (!r.rowCount) { console.log('NO ROW — database is empty.'); process.exit(1); }
    const dbState = r.rows[0].state as Record<string, unknown>;

    console.log(`Revision: ${r.rows[0].revision}`);
    console.log(`Updated:  ${r.rows[0].updated_at}`);
    console.log(`Source SHA256: ${srcHash}`);

    const srcCanon = canonString(srcState);
    const dstCanon = canonString(dbState);
    const ok = srcCanon === dstCanon;
    console.log(`Content match: ${ok ? 'YES' : 'NO'}`);

    if (!ok) {
      const minLen = Math.min(srcCanon.length, dstCanon.length);
      let diffAt = -1;
      for (let i = 0; i < minLen; i++) {
        if (srcCanon[i] !== dstCanon[i]) { diffAt = i; break; }
      }
      if (diffAt < 0 && srcCanon.length !== dstCanon.length) diffAt = minLen;
      if (diffAt >= 0) {
        console.log(`First difference at offset ${diffAt}`);
        console.log(`  source: ${JSON.stringify(srcCanon.slice(diffAt, diffAt + 60))}`);
        console.log(`  stored: ${JSON.stringify(dstCanon.slice(diffAt, diffAt + 60))}`);
      }
      process.exit(2);
    }

    const counts: Record<string, number> = {};
    let total = 0;
    for (const [k, v] of Object.entries(srcState)) {
      if (Array.isArray(v)) { counts[k] = v.length; total += v.length; }
    }
    console.log(`Total array records: ${total}`);
    console.log('Status: VERIFIED');
  } finally {
    await client.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });