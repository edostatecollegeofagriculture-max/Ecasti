import 'dotenv/config';
import { apiRouter } from "../server/apiRouter";

console.log(`Before: ${(apiRouter as any).stack.length} layers`);

// Try to register the 5th route manually (the eligibility route)
try {
  console.log("\nRegistering eligibility route manually...");
  (apiRouter as any).get('/academic-progression/students/:studentId/eligibility', 
    (_req: any, res: any) => res.json({ success: true })
  );
  console.log(`After: ${(apiRouter as any).stack.length} layers`);
} catch (err: any) {
  console.error(`REGISTRATION FAILED: ${err.message}`);
  console.error(err.stack);
}
