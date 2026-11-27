import { readFileSync, writeFileSync } from 'fs';
const path = './server/apiRouter.ts';
let src = readFileSync(path, 'utf8');

// Convert every // line comment (outside strings) to a /* */ block comment.
let out = '';
let inSingle = false, inDouble = false, inTemplate = false, escaped = false;
let converted = 0;
for (let i = 0; i < src.length; i++) {
  const c = src[i];
  if (escaped) { out += c; escaped = false; continue; }
  if (c === '\\') { out += c; escaped = true; continue; }
  if (inSingle) { out += c; if (c === "'") inSingle = false; continue; }
  if (inDouble) { out += c; if (c === '"') inDouble = false; continue; }
  if (inTemplate) { out += c; if (c === '`') inTemplate = false; continue; }
  if (c === "'") { inSingle = true; out += c; continue; }
  if (c === '"') { inDouble = true; out += c; continue; }
  if (c === '`') { inTemplate = true; out += c; continue; }
  if (c === '/' && src[i+1] === '/') {
    let j = i + 2;
    while (j < src.length && src[j] !== '\n' && src[j] !== '\r') j++;
    const body = src.slice(i + 2, j);
    // Block comments can't contain */ — escape if present
    const safeBody = body.replace(/\*\//g, '*\\/');
    out += '/*' + safeBody + '*/';
    converted++;
    i = j - 1;
    continue;
  }
  out += c;
}
writeFileSync(path, out, 'utf8');
console.log(`Converted ${converted} // line comments to /* */ block comments.`);
