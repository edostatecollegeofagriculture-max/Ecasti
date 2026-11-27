import { readFileSync } from 'fs';
const content = readFileSync('./server/apiRouter.ts', 'utf8');

// Check chars 2905-3400 for non-ASCII
console.log("=== NON-ASCII CHARS 2905-3400 ===");
let found = 0;
for (let i = 2905; i < 3400; i++) {
  const c = content.charCodeAt(i);
  if (c > 126 || (c < 32 && c !== 10 && c !== 13)) {
    console.log(`  @ ${i}: 0x${c.toString(16)} (${JSON.stringify(content[i])})`);
    found++;
  }
}
if (found === 0) console.log("  (none found)");

// Show the raw segment
console.log("\n=== RAW 2905-2950 ===");
console.log(JSON.stringify(content.substring(2905, 2950)));
