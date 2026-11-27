import { readFileSync } from 'fs';
const content = readFileSync('./server/apiRouter.ts', 'utf8');

// Track single quote depth
let depth = 0;
let lastOpen = -1;
let issues: { pos: number; depth: number; context: string }[] = [];

for (let i = 0; i < content.length; i++) {
  const c = content[i];
  if (c === "'" && content[i-1] !== '\\' && content[i+1] !== "'") {
    if (depth === 0) {
      depth = 1;
      lastOpen = i;
    } else {
      depth = 0;
    }
  }
}

console.log(`Final single-quote depth: ${depth}`);
console.log(`Last open single quote at: ${lastOpen}`);

if (depth === 1 && lastOpen >= 0) {
  console.log(`\n=== CONTEXT AROUND UNCLOSED QUOTE @ ${lastOpen} ===`);
  console.log(content.substring(Math.max(0, lastOpen - 200), lastOpen + 400));
  console.log(`\n=== CHAR AT ${lastOpen} ===`);
  console.log(JSON.stringify(content.substring(lastOpen - 10, lastOpen + 50)));
}
