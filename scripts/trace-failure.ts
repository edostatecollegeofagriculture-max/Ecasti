import 'dotenv/config';
import { readFileSync } from 'fs';

const content = readFileSync('./server/apiRouter.ts', 'utf8');

// Find the position of the last registered route
const preserveIdx = content.indexOf('preserve-student-cleanup');
console.log(`\nLast registered route "preserve-student-cleanup" at char: ${preserveIdx}`);

// Show the code after it (where the failure happens)
if (preserveIdx >= 0) {
  const after = content.substring(preserveIdx, Math.min(preserveIdx + 3000, content.length));
  console.log("\n=== 3000 CHARS AFTER LAST REGISTERED ROUTE ===\n");
  console.log(after);
}

// Find all throw new Error positions
console.log("\n=== THROW NEW ERROR POSITIONS ===");
let throwIdx = 0;
while ((throwIdx = content.indexOf('throw new Error', throwIdx)) >= 0) {
  const context = content.substring(Math.max(0, throwIdx - 150), Math.min(throwIdx + 300, content.length));
  console.log(`\n--- throw at char ${throwIdx} ---`);
  console.log(context);
  throwIdx += 1;
}
