import { readFileSync } from 'fs';
const src = readFileSync('./server/apiRouter.ts', 'utf8');

// 1. Find "preserve-student-cleanup" — everything after this should be routes
const anchor = 'preserve-student-cleanup';
const anchorPos = src.indexOf(anchor);
console.log(`Anchor '${anchor}' at: ${anchorPos}`);
console.log(`File length: ${src.length}`);
console.log(`Chars AFTER anchor: ${src.length - anchorPos}\n`);

// 2. Show 600 chars after the anchor — where the parser dies
if (anchorPos >= 0) {
  console.log('=== 600 CHARS AFTER ANCHOR ===');
  console.log(JSON.stringify(src.substring(anchorPos, anchorPos + 600)));
  console.log();
}

// 3. Count /* and */ (naive but useful)
const openBlock  = (src.match(/\/\*/g) || []).length;
const closeBlock = (src.match(/\*\//g) || []).length;
console.log(`/* count: ${openBlock}  */ count: ${closeBlock}  => ${openBlock === closeBlock ? 'BALANCED' : 'UNBALANCED ← problem'}`);

// 4. Count backticks not preceded by backslash
let ticks = 0;
for (let i = 0; i < src.length; i++) {
  if (src[i] === '`' && src[i-1] !== '\\') ticks++;
}
console.log(`Backticks (unescaped): ${ticks} => ${ticks % 2 === 0 ? 'EVEN' : 'ODD ← problem'}`);

// 5. Locate every /* and */ with position so we can see if one /* has no partner
console.log('\n=== BLOCK COMMENT MARKERS ===');
const reOpen = /\/\*/g, reClose = /\*\//g;
let m;
console.log('Open /* :');
while ((m = reOpen.exec(src)) !== null) {
  if (m.index > anchorPos - 200 && m.index < anchorPos + 2000)
    console.log(`  @ ${m.index}: ${JSON.stringify(src.substring(m.index, m.index + 60))}`);
}
console.log('Close */ :');
while ((m = reClose.exec(src)) !== null) {
  if (m.index > anchorPos - 200 && m.index < anchorPos + 2000)
    console.log(`  @ ${m.index}: ${JSON.stringify(src.substring(m.index - 40, m.index + 20))}`);
}
