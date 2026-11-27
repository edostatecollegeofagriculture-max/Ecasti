import { transformSync } from 'esbuild';
import { readFileSync } from 'fs';
const src = readFileSync('./server/apiRouter.ts', 'utf8');
try {
  transformSync(src, { loader: 'ts', format: 'cjs' });
  console.log('OK');
} catch (e: any) {
  const er = (e.errors && e.errors[0]) || {};
  console.log('Error text:', er.text);
  console.log('Location:', JSON.stringify(er.location));
  if (er.location) {
    const { line, column } = er.location;
    const lines = src.split('\n');
    let abs = 0;
    for (let i = 0; i < line - 1; i++) abs += lines[i].length + 1;
    abs += column - 1;
    console.log(`\nAbsolute offset: ${abs}`);
    console.log(`File length: ${src.length}`);
    console.log(`\n=== 500 chars ENDING at ${abs} ===`);
    console.log(JSON.stringify(src.substring(Math.max(0, abs - 500), abs)));
    console.log(`\n=== 200 chars STARTING at ${abs} ===`);
    console.log(JSON.stringify(src.substring(abs, abs + 200)));
  }
}
