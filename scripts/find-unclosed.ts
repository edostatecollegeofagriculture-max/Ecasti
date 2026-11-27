import { readFileSync } from 'fs';
const src = readFileSync('./server/apiRouter.ts', 'utf8');

let inSingle = false, inDouble = false, inTemplate = false;
let templateExprDepth = 0;
let escaped = false;
let quoteBalance = 0;           // +1 on open, -1 on close
let firstUnbalanced = -1;       // position where balance went 0 -> 1 and stayed
let openStack: number[] = [];

for (let i = 0; i < src.length; i++) {
  const c = src[i];
  if (escaped) { escaped = false; continue; }
  if (c === '\\') { escaped = true; continue; }

  if (inTemplate) {
    if (c === '`') { inTemplate = false; }
    else if (c === '$' && src[i+1] === '{') { templateExprDepth++; i++; }
    else if (c === '}' && templateExprDepth > 0) { templateExprDepth--; }
    continue;
  }
  if (inSingle) {
    if (c === "'") { inSingle = false; quoteBalance--; openStack.pop(); }
    continue;
  }
  if (inDouble) {
    if (c === '"') inDouble = false;
    continue;
  }

  if (c === "'") { inSingle = true; quoteBalance++; openStack.push(i); continue; }
  if (c === '"') { inDouble = true; continue; }
  if (c === '`') { inTemplate = true; continue; }
}

console.log(`Final inSingle=${inSingle} inDouble=${inDouble} inTemplate=${inTemplate}`);
console.log(`Final quoteBalance=${quoteBalance}`);
console.log(`Open quote stack (unclosed): ${JSON.stringify(openStack)}`);

if (openStack.length > 0) {
  for (const pos of openStack) {
    console.log(`\n>>> UNCLOSED SINGLE QUOTE at char ${pos}`);
    console.log('Context:', JSON.stringify(src.substring(Math.max(0, pos-100), pos+300)));
  }
} else if (inDouble) {
  console.log('\n>>> Unclosed DOUBLE quote (find it by scanning backwards from end)');
}
