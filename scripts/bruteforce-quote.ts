import { transformSync } from 'esbuild';
import { readFileSync } from 'fs';
const src = readFileSync('./server/apiRouter.ts', 'utf8');

function parses(s: string): boolean {
  try { transformSync(s, { loader: 'ts', format: 'cjs', logLevel: 'silent' }); return true; }
  catch { return false; }
}

const candidates: number[] = [];
for (let i = 0; i < Math.min(3263, src.length); i++) {
  if (src[i] === "'") candidates.push(i);
}
console.log(`Testing ${candidates.length} quote positions in [0, 3263)...`);

const fixes: number[] = [];
for (const p of candidates) {
  // Try 1: delete the quote
  if (parses(src.substring(0, p) + src.substring(p + 1))) {
    fixes.push(p);
    console.log(`\n>>> DELETING quote at ${p} makes the file parse!`);
    console.log('Context:', JSON.stringify(src.substring(Math.max(0, p - 200), p + 100)));
  }
}
if (fixes.length === 0) console.log('\nNo single-quote deletion fixes it. Trying INSERTION of a quote...');
