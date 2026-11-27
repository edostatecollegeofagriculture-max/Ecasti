import { readFileSync } from 'fs';
const src = readFileSync('./server/apiRouter.ts', 'utf8');
let found = 0;
for (let i = 0; i < src.length; i++) {
  const cp = src.codePointAt(i)!;
  if (cp === 0x2028 || cp === 0x2029) {
    found++;
    console.log(`U+${cp.toString(16).toUpperCase()} at char ${i}`);
    console.log('  Context:', JSON.stringify(src.substring(Math.max(0,i-80), i+80)));
  }
}
for (let i = 0; i < src.length; i++) {
  if (src[i] === '\r' && src[i+1] !== '\n') {
    found++;
    console.log(`Lone CR at char ${i}`);
    console.log('  Context:', JSON.stringify(src.substring(Math.max(0,i-80), i+80)));
  }
}
console.log(`Done. Found ${found} suspicious line terminators.`);
