import 'dotenv/config';

const { apiRouter } = await import("../server/apiRouter");
console.log(`Before: ${(apiRouter as any).stack.length} layers`);

// Try adding a route
(apiRouter as any).get('/test-accepts-route', (_req: any, res: any) => res.json({ ok: true }));
console.log(`After: ${(apiRouter as any).stack.length} layers`);

// If the count went up, the router is fine — the file's evaluation is skipping routes
