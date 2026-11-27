import { readFileSync, writeFileSync } from 'fs';

const content = readFileSync('./server/apiRouter.ts', 'utf8');

// Find the 5th route position
const route5 = content.indexOf("apiRouter.get(  '/academic-progression/students/:studentId/eligibility'");
console.log(`Route 5 at char: ${route5}`);

// Inject a log right before it
const before = content.substring(0, route5);
const after = content.substring(route5);
const injected = before + "\nconsole.log('[REACHED ROUTE 5 REGISTRATION]');\n" + after;

// Write debug copy
writeFileSync('./server/apiRouter-DEBUG.ts', injected, 'utf8');
console.log(`Debug copy written (${injected.length} chars)`);

// Load the debug copy
try {
  const { apiRouter } = await import("../server/apiRouter-DEBUG");
  console.log(`\nDEBUG router: ${(apiRouter as any).stack.length} layers`);
} catch (err: any) {
  console.error(`\nDEBUG import failed: ${err.message}`);
  console.error(err.stack);
}
