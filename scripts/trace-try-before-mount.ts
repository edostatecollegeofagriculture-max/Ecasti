import { readFileSync } from 'fs';
const content = readFileSync('./server/apiRouter.ts', 'utf8');

// Show chars 1000-1500 (before and around the mounts)
console.log("=== CHARS 1000-1500 ===");
console.log(content.substring(1000, 1500));

// Find all try positions
let idx = 0;
const tries: number[] = [];
while ((idx = content.indexOf('try {', idx)) >= 0) {
  tries.push(idx);
  idx += 1;
}
console.log("\n=== TRY POSITIONS ===");
tries.forEach((p, i) => console.log(`  ${i}: @ ${p}`));

// Check if any try is before the mount at 1349
const beforeMount = tries.filter((p) => p < 1349);
console.log(`\nTries before mount (char 1349): ${beforeMount.length}`);
beforeMount.forEach((p) => {
  console.log(`  @ ${p}: ${content.substring(p - 20, p + 100)}`);
});
