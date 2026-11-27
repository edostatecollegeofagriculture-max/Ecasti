import { readFileSync } from 'fs';
const content = readFileSync('./server/apiRouter.ts', 'utf8');

// Find all apiRouter.use positions
const usePattern = /apiRouter\.use\s*\(\s*['"]([^'"]+)['"]/g;
let match;
console.log("=== APIROUTER.USE CALLS ===");
while ((match = usePattern.exec(content)) !== null) {
  console.log(`  @ ${match.index}: apiRouter.use('${match[1]}', ...)`);
}

// Find documentsApiRouter positions
let idx = 0;
console.log("\n=== DOCUMENTSAPIROUTER MENTIONS ===");
while ((idx = content.indexOf('documentsApiRouter', idx)) >= 0) {
  console.log(`  @ ${idx}: ${content.substring(Math.max(0, idx - 50), idx + 80).replace(/\n/g, ' ')}`);
  idx += 1;
}

// Find the import statements
const importMatches = content.match(/import[^;]+from\s+['"][^'"]+['"]/g) || [];
console.log("\n=== IMPORTS (first 20) ===");
importMatches.slice(0, 20).forEach((imp, i) => console.log(`${i}: ${imp.substring(0, 100)}`));
