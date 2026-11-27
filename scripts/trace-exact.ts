import { readFileSync } from 'fs';
const content = readFileSync('./server/apiRouter.ts', 'utf8');

// Show chars 150,400-150,600 (esbuild error position)
console.log("=== CHARS 150,400-150,600 ===");
console.log(content.substring(150400, 150600));

console.log("\n=== CHARS 150,450-150,500 (exact error) ===");
console.log(JSON.stringify(content.substring(150450, 150500)));

// Count quotes (unclosed string would cause this)
let singleQuotes = 0;
let doubleQuotes = 0;
let backticks = 0;
for (let i = 0; i < content.length; i++) {
  if (content[i] === "'" && content[i-1] !== '\\') singleQuotes++;
  if (content[i] === '"' && content[i-1] !== '\\') doubleQuotes++;
  if (content[i] === '`' && content[i-1] !== '\\') backticks++;
}
console.log(`\nSingle quotes: ${singleQuotes} (should be even)`);
console.log(`Double quotes: ${doubleQuotes} (should be even)`);
console.log(`Backticks: ${backticks} (should be even)`);
