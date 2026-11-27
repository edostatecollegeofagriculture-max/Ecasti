import { readFileSync } from 'fs';
const src = readFileSync('./server/apiRouter.ts', 'utf8');
console.log(`File length: ${src.length}`);
console.log(`\n=== 153,560 .. 153,815 (last 255 chars) ===`);
console.log(JSON.stringify(src.substring(153560)));
console.log(`\n=== char-by-char 153,600 .. 153,720 ===`);
for (let i = 153600; i < Math.min(src.length, 153720); i++) {
  console.log(`  ${i}: 0x${src.charCodeAt(i).toString(16).padStart(4,'0')} ${JSON.stringify(src[i])}`);
}
