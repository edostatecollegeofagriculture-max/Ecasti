import 'dotenv/config';
import { readFileSync } from 'fs';

// Load apiRouter and count routes
const { apiRouter } = await import("../server/apiRouter");
const stack = (apiRouter as any).stack;
console.log(`apiRouter: ${stack.length} layers`);

// Check the source file
const content = readFileSync('./server/apiRouter.ts', 'utf8');
console.log(`\n=== SOURCE FILE ANALYSIS ===`);
console.log(`Total chars: ${content.length}`);
console.log(`Total lines: ${content.split('\n').length}`);
console.log(`apiRouter.get/post/put/patch/delete calls: ${(content.match(/apiRouter\.(get|post|put|patch|delete)\s*\(/g) || []).length}`);
console.log(`try blocks: ${(content.match(/try\s*\{/g) || []).length}`);
console.log(`catch blocks: ${(content.match(/catch\s*\(/g) || []).length}`);
console.log(`documentsApiRouter mentions: ${(content.match(/documentsApiRouter/g) || []).length}`);
console.log(`academicProgressionApiRouter mentions: ${(content.match(/academicProgressionApiRouter/g) || []).length}`);
console.log(`apiRouter.use calls: ${(content.match(/apiRouter\.use\s*\(/g) || []).length}`);

// Check for early return or throw
const hasEarlyReturn = /return\s+res\.status/.test(content) && !/function\s+\w+\s*\([^)]*\)\s*\{[^}]*return\s+res\.status/.test(content);
console.log(`\nSuspicious patterns:`);
console.log(`  __dirname/__filename: ${(content.match(/__dirname|__filename/g) || []).length}`);
console.log(`  process.exit: ${(content.match(/process\.exit/g) || []).length}`);
console.log(`  throw new Error: ${(content.match(/throw new Error/g) || []).length}`);

// Check the file size
console.log(`\nFile size on disk: ${content.length} chars`);
