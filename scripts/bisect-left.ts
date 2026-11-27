import { transformSync } from 'esbuild';
import { readFileSync } from 'fs';
const src = readFileSync('./server/apiRouter.ts', 'utf8');

function errOf(s: string): string {
  try {
    transformSync(s, { loader: 'ts', format: 'cjs', logLevel: 'silent' });
    return 'OK';
  } catch (e: any) {
    const er = e.errors && e.errors[0];
    return (er && er.text) || e.message || 'UNKNOWN';
  }
}

// Find first prefix (in steps) where errOf becomes "Unexpected end of file"
let firstEOF = -1;
for (let n = 100; n <= src.length; n += 100) {
  const e = errOf(src.substring(0, n));
  if (/Unexpected end of file/i.test(e)) { firstEOF = n; break; }
}
console.log(`First prefix length with "Unexpected end of file": ${firstEOF}`);

if (firstEOF > 0) {
  // Narrow down exactly: walk back to the smallest prefix that has this error
  let lo = Math.max(1, firstEOF - 100), hi = firstEOF;
  let smallest = firstEOF;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const e = errOf(src.substring(0, mid));
    if (/Unexpected end of file/i.test(e)) { smallest = mid; hi = mid - 1; }
    else { lo = mid + 1; }
  }
  console.log(`Smallest prefix with "Unexpected end of file": ${smallest}`);
  console.log(`\n=== 300 chars ENDING at ${smallest} ===`);
  console.log(JSON.stringify(src.substring(Math.max(0, smallest - 300), smallest)));
  console.log(`\n=== 100 chars AFTER ${smallest} ===`);
  console.log(JSON.stringify(src.substring(smallest, smallest + 100)));

  // The opener is likely the LAST ' in that 300-char window
  const window = src.substring(Math.max(0, smallest - 300), smallest);
  const lastQuoteInWindow = window.lastIndexOf("'");
  if (lastQuoteInWindow >= 0) {
    const absPos = Math.max(0, smallest - 300) + lastQuoteInWindow;
    console.log(`\n>>> Candidate unclosed quote @ ${absPos}:`);
    console.log(JSON.stringify(src.substring(Math.max(0, absPos - 100), absPos + 300)));
  }
}
