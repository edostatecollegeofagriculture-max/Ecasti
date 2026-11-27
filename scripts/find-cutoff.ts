import { transformSync } from 'esbuild';
import { readFileSync } from 'fs';
const src = readFileSync('./server/apiRouter.ts', 'utf8');

function outLen(s: string): number {
  try { return transformSync(s, { loader: 'ts', format: 'cjs', logLevel: 'silent' }).code.length; }
  catch { return -1; }
}

const FULL = outLen(src);
console.log(`Full output: ${FULL} chars`);

let lo = 1, hi = src.length, plateauStart = -1;
while (lo <= hi) {
  const mid = Math.floor((lo + hi) / 2);
  const len = outLen(src.substring(0, mid));
  if (len === FULL) { plateauStart = mid; hi = mid - 1; }
  else { lo = mid + 1; }
}

console.log(`Smallest prefix producing full output: ${plateauStart} chars`);
console.log(`\n=== CONTEXT AROUND CUTOFF ===`);
console.log(JSON.stringify(src.substring(Math.max(0, plateauStart - 300), plateauStart + 300)));
console.log(`\n=== 150 CHARS BEFORE CUTOFF, CHAR BY CHAR ===`);
for (let i = Math.max(0, plateauStart - 150); i < Math.min(src.length, plateauStart + 10); i++) {
  const c = src.charCodeAt(i);
  const ch = JSON.stringify(src[i]);
  console.log(`  ${i}: 0x${c.toString(16).padStart(4,'0')} ${ch}`);
}
