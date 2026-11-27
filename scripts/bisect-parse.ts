import { transformSync } from 'esbuild';
import { readFileSync } from 'fs';
const src = readFileSync('./server/apiRouter.ts', 'utf8');

function tryParse(s: string): { ok: boolean; err: string } {
  try {
    transformSync(s, { loader: 'ts', format: 'cjs', logLevel: 'silent' });
    return { ok: true, err: '' };
  } catch (e: any) {
    const msg = (e.errors && e.errors[0] && e.errors[0].text) || e.message || '';
    return { ok: false, err: msg };
  }
}

// Find every position where a ' is the LAST character of a valid-ish prefix.
// Strategy: for each single quote position p (from a naive scan, which is fine here
// because we only care about quote POSITIONS not state), check if src[0..p+1] parses.
// If it parses cleanly (or with a different error), p+1 is a candidate string endpoint.

// First, collect all ' positions with a simple scan (state doesn't matter for positions)
const quotePositions: number[] = [];
for (let i = 0; i < src.length; i++) if (src[i] === "'") quotePositions.push(i);
console.log(`Total single quotes: ${quotePositions.length}`);

// Bisect on the [0..N] prefix: find the smallest N where tryParse stops saying
// "Unexpected end of file"
let lo = 0, hi = src.length, firstNonEOF = -1;
// Quick probe: parse full file
const full = tryParse(src);
console.log(`Full file: ok=${full.ok} err=${JSON.stringify(full.err)}`);

// Binary search: find smallest prefix length where error is NOT "Unexpected end of file"
while (lo <= hi) {
  const mid = Math.floor((lo + hi) / 2);
  const r = tryParse(src.substring(0, mid));
  const isEOFErr = !r.ok && /Unexpected end of file/i.test(r.err);
  if (!isEOFErr) { firstNonEOF = mid; hi = mid - 1; }
  else { lo = mid + 1; }
}
console.log(`Smallest prefix that is NOT "Unexpected end of file": ${firstNonEOF}`);
if (firstNonEOF >= 0) {
  console.log('Context:', JSON.stringify(src.substring(Math.max(0, firstNonEOF - 300), firstNonEOF + 100)));
  // The last ' before firstNonEOF is the unclosed opener
  const before = quotePositions.filter(p => p < firstNonEOF);
  if (before.length > 0) {
    const opener = before[before.length - 1];
    console.log(`\n>>> Likely unclosed quote at ${opener}`);
    console.log('Context:', JSON.stringify(src.substring(Math.max(0, opener - 200), opener + 400)));
  }
}
