import { transformSync } from 'esbuild';
import { readFileSync } from 'fs';
const src = readFileSync('./server/apiRouter.ts', 'utf8');

function outLen(s: string) {
  try {
    const r = transformSync(s, { loader: 'ts', format: 'cjs', logLevel: 'silent' });
    return { len: r.code.length, warns: r.warnings.length };
  } catch (e: any) {
    return { len: -1, err: e.message?.slice(0, 200) };
  }
}

// Full file
const full = outLen(src);
console.log(`Full file (${src.length} chars) -> output ${full.len} chars, ${full.warns} warnings`);

// Binary-search: find the smallest prefix length where output length plateaus
let lo = 0, hi = src.length;
let lastGood = 0;
// Test a coarse grid first
for (let p = 1000; p <= src.length; p += 5000) {
  const r = outLen(src.substring(0, p));
  if (r.len >= 0 && r.len > lastGood) {
    lastGood = r.len;
    process.stdout.write(`  prefix ${p}: out ${r.len}\r`);
  }
}
console.log(`\nCoarse scan done. Last output growth seen at prefix ~${lastGood} bytes.`);

// Now find exact plateau: smallest prefix where output stops growing
let prev = -1;
for (let p = Math.max(1000, lastGood - 20000); p <= Math.min(src.length, lastGood + 20000); p += 100) {
  const r = outLen(src.substring(0, p));
  if (r.len === prev) {
    console.log(`\n>>> Output plateau begins at prefix length ${p} (output stays ${r.len} chars)`);
    console.log(`    That is char ${p} of the file.`);
    console.log(`    Context: ${JSON.stringify(src.substring(Math.max(0,p-200), p + 200))}`);
    break;
  }
  prev = r.len;
}
