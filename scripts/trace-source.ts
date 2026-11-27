import { readFileSync } from 'fs';
const content = readFileSync('./server/apiRouter.ts', 'utf8');

// Count ALL route registrations
const routes = content.match(/apiRouter\.(get|post|put|patch|delete)\s*\(/g) || [];
console.log(`Total apiRouter route calls in source: ${routes.length}`);

// Count middleware mounts
const mounts = content.match(/apiRouter\.use\s*\(/g) || [];
console.log(`Total apiRouter.use calls in source: ${mounts.length}`);

// Find each route path and position
const pattern = /apiRouter\.(get|post|put|patch|delete)\s*\(\s*'([^']+)'/g;
let match;
const routes_list: { method: string; path: string; pos: number }[] = [];
while ((match = pattern.exec(content)) !== null) {
  routes_list.push({ method: match[1].toUpperCase(), path: match[2], pos: match.index });
}

console.log(`\nTotal routes found with paths: ${routes_list.length}`);
console.log(`\n=== ROUTES 0-10 ===`);
routes_list.slice(0, 10).forEach((r, i) => console.log(`${i}: ${r.method} ${r.path} @ ${r.pos}`));

console.log(`\n=== ROUTES 100+ ===`);
routes_list.slice(100).forEach((r, i) => console.log(`${100 + i}: ${r.method} ${r.path} @ ${r.pos}`));

// Find positions of the two throws
const throw1 = content.indexOf('throw new Error');
const throw2 = content.indexOf('throw new Error', throw1 + 1);
console.log(`\nThrow 1 @ ${throw1}`);
console.log(`Throw 2 @ ${throw2}`);
console.log(`Total chars: ${content.length}`);

// Check where the 4th demo route ends vs where throw 1 is
const demo4 = content.indexOf('preserve-student-cleanup');
console.log(`\nDemo route 4 "preserve-student-cleanup" @ ${demo4}`);
console.log(`Distance to Throw 1: ${throw1 - demo4} chars`);
