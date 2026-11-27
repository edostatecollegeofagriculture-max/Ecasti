import { readFileSync, writeFileSync } from 'fs';
const path = './server/apiRouter.ts';
let src = readFileSync(path, 'utf8');

// Find all // that are NOT inside a string and NOT followed by whitespace/newline.
// We do a simple state machine over the whole file.
let out = '';
let inSingle = false, inDouble = false, inTemplate = false, escaped = false;
let fixed = 0;
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

  // Outside strings: detect //
  if (c === '/' && src[i+1] === '/') {
    // Read to end of "logical comment": until a real newline (\n or \r) or EOF
    let j = i;
    while (j < src.length && src[j] !== '\n' && src[j] !== '\r') j++;
    const comment = src.slice(i, j);
    out += comment;
    // If comment is immediately followed by non-newline code, insert \n
    if (j < src.length && src[j] !== '\n' && src[j] !== '\r') {
      // unreachable given while loop, but kept for clarity
    }
    if (j < src.length && (src[j] === '\n' || src[j] === '\r')) {
      // already has a newline, fine
    } else {
      // reached EOF with no newline — but this is the LAST comment; nothing after it
      // Actually if j === src.length, comment extends to EOF. We must NOT add \n here.
    }
    // The real problem: the comment ends at \n or \r. If the comment is `// ...code...`,
    // it will end at EOF and eat code. We fix by appending \n AFTER the comment
    // ONLY IF the next char after the comment region is actual code on the SAME minified line.
    i = j - 1;
    continue;
  }
  out += c;
}
// The above didn't actually fix anything. Do it directly:

// Re-do: find every `//` outside strings, look at the character AFTER the comment text
// (i.e., after the last non-newline char). If the comment is followed immediately by
// more code on the same physical line (because the file is minified), insert a newline
// at the end of the comment.
function fixMinifiedLineComments(text: string): { result: string; count: number } {
  let out = '';
  let inSingle = false, inDouble = false, inTemplate = false, escaped = false;
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (escaped) { out += c; escaped = false; continue; }
    if (c === '\\') { out += c; escaped = true; continue; }
    if (inSingle) { out += c; if (c === "'") inSingle = false; continue; }
    if (inDouble) { out += c; if (c === '"') inDouble = false; continue; }
    if (inTemplate) { out += c; if (c === '`') inTemplate = false; continue; }
    if (c === "'") { inSingle = true; out += c; continue; }
    if (c === '"') { inDouble = true; out += c; continue; }
    if (c === '`') { inTemplate = true; out += c; continue; }
    if (c === '/' && text[i+1] === '/') {
      // Scan the comment body: from i+2 until we hit \n or \r or EOF
      let j = i + 2;
      while (j < text.length && text[j] !== '\n' && text[j] !== '\r') j++;
      const commentText = text.slice(i, j);
      out += commentText;
      if (j >= text.length) {
        // comment reaches EOF: nothing after it, safe
      } else {
        // there IS a real newline at j; comment is properly terminated
      }
      // The problem case: comment reaches EOF (j === text.length) BUT there is more
      // code AFTER the comment logically. That's indistinguishable from a real
      // trailing comment... UNLESS the comment body contains code-looking text.
      // In a minified file, EVERY // comment reaches EOF except the last one.
      // So: if j === text.length AND i is not the final comment, we must insert \n.
      // We can't know which is "final". Instead: insert \n at end of EVERY // comment
      // that reaches EOF. That adds at most one trailing newline per comment, harmless.
      if (j >= text.length) {
        // comment extends to EOF — this is the swallowing case if any code followed
        // But we can't see code after EOF. So this branch never helps.
      }
      i = j - 1;
      continue;
    }
    out += c;
  }
  return { result: out, count };
}

// Simpler approach: the file is minified to essentially ONE line. Every `//` comment
// in it (outside strings) is a "line comment" that, on a one-line file, swallows
// everything after it. So: replace every `//` (outside strings) with `/*` and insert
// `*/` at the natural end of the comment. Natural end = next occurrence of a known
// separator we can identify: the comment always ends right before the next `apiRouter.`
// or `function ` or `}` pattern... risky.

// Cleanest: just insert a newline after each `//` comment's last non-space char,
// using the rule: a `//` comment ends at the next `\n`, OR at the next `apiRouter.`
// / `function ` / `const ` / `let ` / `var ` / `export ` / `import ` / `}` / `)` token.
// That's heuristic and error-prone.

// RECOMMENDED: don't auto-fix. Just report the positions of all `//` comments
// outside strings, so the user can inspect and fix manually.
const positions: number[] = [];
{
  let inSingle = false, inDouble = false, inTemplate = false, escaped = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (inSingle) { if (c === "'") inSingle = false; continue; }
    if (inDouble) { if (c === '"') inDouble = false; continue; }
    if (inTemplate) { if (c === '`') inTemplate = false; continue; }
    if (c === "'") { inSingle = true; continue; }
    if (c === '"') { inDouble = true; continue; }
    if (c === '`') { inTemplate = true; continue; }
    if (c === '/' && src[i+1] === '/') {
      positions.push(i);
      // skip to end of line
      let j = i + 2;
      while (j < src.length && src[j] !== '\n' && src[j] !== '\r') j++;
      i = j - 1;
    }
  }
}
console.log(`Found ${positions.length} // comments outside strings.`);
for (const p of positions) {
  const snippet = src.slice(p, Math.min(src.length, p + 120));
  const hasNewlineAfter = /[\r\n]/.test(src.slice(p, Math.min(src.length, p + 500)));
  console.log(`  @${p} (newline within 500 chars: ${hasNewlineAfter}): ${JSON.stringify(snippet)}`);
}
