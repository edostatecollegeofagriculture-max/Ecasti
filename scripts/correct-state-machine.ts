import { readFileSync } from 'fs';
const src = readFileSync('./server/apiRouter.ts', 'utf8');

let inSingle = false, inDouble = false, inTemplate = false;
let templateExprDepth = 0;  // tracks ${ ... } nesting inside templates
let escaped = false;
const transitions: Array<{pos: number; state: string; char: string}> = [];

for (let i = 0; i < src.length; i++) {
  const c = src[i];
  if (escaped) { escaped = false; continue; }
  if (c === '\\') { escaped = true; continue; }

  if (inTemplate) {
    if (c === '`') { inTemplate = false; transitions.push({pos:i,state:'close-template',char:c}); continue; }
    // handle ${ ... } — needs brace counting
    if (c === '$' && src[i+1] === '{') { templateExprDepth++; transitions.push({pos:i,state:'open-template-expr',char:'${'}); i++; continue; }
    if (c === '}' && templateExprDepth > 0) { templateExprDepth--; transitions.push({pos:i,state:'close-template-expr',char:'}'}); continue; }
    continue;
  }

  if (inSingle) {
    if (c === "'") { inSingle = false; transitions.push({pos:i,state:'close-single',char:c}); }
    continue;
  }
  if (inDouble) {
    if (c === '"') { inDouble = false; transitions.push({pos:i,state:'close-double',char:c}); }
    continue;
  }

  if (c === "'") { inSingle = true; transitions.push({pos:i,state:'open-single',char:c}); continue; }
  if (c === '"') { inDouble = true; transitions.push({pos:i,state:'open-double',char:c}); continue; }
  if (c === '`') { inTemplate = true; transitions.push({pos:i,state:'open-template',char:c}); continue; }
}

console.log(`Final state: single=${inSingle} double=${inDouble} template=${inTemplate} templateExprDepth=${templateExprDepth}`);
const opens = transitions.filter(t => t.state.startsWith('open'));
const closes = transitions.filter(t => t.state.startsWith('close'));
console.log(`Opens: ${opens.length}, Closes: ${closes.length}`);
if (inSingle || inDouble || inTemplate) {
  const lastOpen = transitions.filter(t => t.state.startsWith('open')).pop();
  console.log(`\n>>> Unclosed ${lastOpen?.state} at char ${lastOpen?.pos}`);
  console.log('Context:', JSON.stringify(src.substring(Math.max(0,(lastOpen?.pos||0)-200), (lastOpen?.pos||0)+400)));
}
// Print the last 10 transitions to see where state flips badly
console.log('\nLast 10 transitions:');
for (const t of transitions.slice(-10)) {
  console.log(`  @${t.pos} ${t.state} ${JSON.stringify(t.char)}`);
}
