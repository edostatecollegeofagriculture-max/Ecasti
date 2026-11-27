import { readFileSync } from 'fs';
const content = readFileSync('./server/apiRouter.ts', 'utf8');

// Count braces and parens
let braces = 0, parens = 0, brackets = 0;
let lastOpenBrace = -1;
let line = 1;

for (let i = 0; i < content.length; i++) {
  const c = content[i];
  if (c === '\n') line++;
  if (c === '{') { braces++; lastOpenBrace = i; }
  if (c === '}') braces--;
  if (c === '(') parens++;
  if (c === ')') parens--;
  if (c === '[') brackets++;
  if (c === ']') brackets--;
}

console.log(`Braces: ${braces} (should be 0)`);
console.log(`Parens: ${parens} (should be 0)`);
console.log(`Brackets: ${brackets} (should be 0)`);
console.log(`Last open brace at char: ${lastOpenBrace}`);
console.log(`Context: ${JSON.stringify(content.substring(lastOpenBrace - 100, lastOpenBrace + 100))}`);
