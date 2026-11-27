import { readFileSync } from 'fs';
const content = readFileSync('./server/apiRouter.ts', 'utf8');

// Show chars 2870-3400 (from demo route 4 to eligibility route)
console.log("=== CHARS 2870-3400 (THE FAILURE WINDOW) ===");
console.log(content.substring(2870, 3400));
