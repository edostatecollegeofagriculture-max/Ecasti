import 'dotenv/config';

// Load first
const { apiRouter } = await import("../server/apiRouter");
console.log(`Initial layers: ${(apiRouter as any).stack.length}`);

// Wrap registration methods to count any future calls
const methods = ['get', 'post', 'put', 'patch', 'delete', 'use'] as const;
let count = 0;

methods.forEach((method) => {
  const original = (apiRouter as any)[method].bind(apiRouter);
  (apiRouter as any)[method] = function (...args: any[]) {
    count++;
    const pathStr = typeof args[0] === 'string' ? args[0] : '(middleware)';
    console.log(`[${count}] ${method.toUpperCase()} ${pathStr}`);
    return original(...args);
  };
});

// Try to trigger more registration by re-running a known route registration
// (this won't actually work, but proves the router is live)
console.log(`\napiRouter is ${typeof apiRouter}`);
console.log(`Stack length: ${(apiRouter as any).stack.length}`);

// List all current routes
const stack = (apiRouter as any).stack;
stack.forEach((layer: any, i: number) => {
  if (layer.route) {
    const methods = Object.keys(layer.route.methods).join(',');
    console.log(`  ${i}: ${methods} ${layer.route.path}`);
  } else {
    console.log(`  ${i}: MIDDLEWARE ${layer.name}`);
  }
});
