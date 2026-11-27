import { readFileSync } from 'fs';
const src = readFileSync('./server/apiRouter.ts', 'utf8');
const re = /apiRouter\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g;
let m, n = 0;
while ((m = re.exec(src)) !== null) { n++; console.log(`${m[1].toUpperCase().padEnd(6)} ${m[2]}`); }
console.log(`\nTotal route definitions found: ${n}`);
