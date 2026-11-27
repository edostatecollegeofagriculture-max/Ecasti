import { readFileSync } from 'fs';
const src = readFileSync('./server/apiRouter.ts', 'utf8');

const patterns: Array<{name: string; re: RegExp}> = [
  { name: 'orphaned value (key missing)', re: /\b\w+\s+\w+Color\s*\|\|/g },
  { name: 'truncated db call',            re: /db\.getSta(?!te\()/g },
  { name: 'truncated identifier ;',       re: /\b\w{3,};/g },
  { name: 'spliced destructure',          re: /\bdefined\)\s*\w+\./g },
  { name: 'double keyword',               re: /\b(bg|const|let|if|return)\s+\1\b/g },
];

let total = 0;
for (const { name, re } of patterns) {
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(src)) !== null) {
    total++;
    const start = Math.max(0, m.index - 60);
    const end   = Math.min(src.length, m.index + m[0].length + 60);
    console.log(`\n[${name}] @ ${m.index}`);
    console.log('  ' + JSON.stringify(src.substring(start, end)));
  }
}
console.log(`\nTotal suspicious matches: ${total}`);
