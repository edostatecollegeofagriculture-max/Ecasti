import { transformSync } from 'esbuild';
import { readFileSync } from 'fs';
const src = readFileSync('./server/apiRouter.ts', 'utf8');

function parses(s: string): boolean {
  try { transformSync(s, { loader: 'ts', format: 'cjs', logLevel: 'silent' }); return true; }
  catch { return false; }
}

// Test ONLY quotes that are: (a) preceded by ' ' or ':' or '(' or '{' or ',' (typical opening positions)
// and (b) followed by an uppercase letter, lowercase letter, or space (typical string starts).
// This cuts candidates from 2,371 to a few hundred — fast enough to scan the whole file.
const candidates: number[] = [];
for (let i = 1; i < src.length; i++) {
  if (src[i] === "'") {
    const prev = src[i-1];
    const next = src[i+1];
    if (/[\s:({,=!>]/.test(prev) && /[A-Za-z 0-9]/.test(next || '')) {
      candidates.push(i);
    }
  }
}
console.log(`Testing ${candidates.length} candidate openings across the whole file...`);

let found = 0;
for (const p of candidates) {
  // Try inserting a matching closing ' right before the next quote or at the end of the identifier/word
  // Simpler: try inserting a ' at every reasonable "close" position after p, but cap the search.
  // Even simpler: just try DELETING the opening quote — if the real problem is a stray opener, delete fixes it.
  if (parses(src.substring(0, p) + src.substring(p + 1))) {
    found++;
    console.log(`\n>>> DELETING ' at ${p} fixes the parse.`);
    console.log('Context:', JSON.stringify(src.substring(Math.max(0, p - 150), p + 150)));
    if (found >= 5) break;
  }
}
if (found === 0) console.log('No single deletion fixes it.');
