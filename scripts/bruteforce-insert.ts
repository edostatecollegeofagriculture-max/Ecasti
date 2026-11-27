import { transformSync } from 'esbuild';
import { readFileSync } from 'fs';
const src = readFileSync('./server/apiRouter.ts', 'utf8');

function parses(s: string): boolean {
  try { transformSync(s, { loader: 'ts', format: 'cjs', logLevel: 'silent' }); return true; }
  catch { return false; }
}

// Try INSERTING a single-quote at EVERY character position, and see if the file parses.
// There are only 153,816 positions, and each parse is ~5ms, so ~12 min. Too slow.
// Narrow: only insert right before a `'` (to make an escaped-quote pair) or right after an `= `
// or `:` or `, ` or `(` or `{`, or before a `,` or `}` or `)`.
const candidates: number[] = [];
for (let i = 0; i < src.length; i++) {
  const prev = i > 0 ? src[i-1] : '';
  const next = i < src.length - 1 ? src[i+1] : '';
  // Insert before a `'` or after `= `, `:`, `, `, `(`, `{`, `[`
  if (next === "'") candidates.push(i);                                    // insert before quote
  if (/[=:(,{[]/.test(prev) && /[A-Za-z0-9 ]/.test(next)) candidates.push(i);  // insert after separators
  if (/[,;)}\]]/.test(next) && /[A-Za-z0-9 ]/.test(prev)) candidates.push(i); // insert before terminators
}
console.log(`Testing ${candidates.length} insertion positions...`);

for (const p of candidates) {
  const patched = src.substring(0, p) + "'" + src.substring(p);
  if (parses(patched)) {
    console.log(`\n>>> INSERTING ' at ${p} FIXES THE PARSE.`);
    console.log('Context BEFORE:', JSON.stringify(src.substring(Math.max(0, p - 150), p)));
    console.log('Context AFTER: ', JSON.stringify(src.substring(p, p + 150)));
    process.exit(0);
  }
}
console.log('No single insertion fixes it either.');
