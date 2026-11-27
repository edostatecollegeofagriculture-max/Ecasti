import 'dotenv/config';

// Load fresh
const { apiRouter } = await import("../server/apiRouter");
const { documentsApiRouter } = await import("../server/documentsApiRouter");

console.log("=== apiRouter state ===");
console.log(`Type: ${typeof apiRouter}`);
console.log(`Stack length: ${(apiRouter as any).stack?.length || 0}`);

console.log("\n=== Layer details ===");
const stack = (apiRouter as any).stack || [];
stack.forEach((layer: any, i: number) => {
  if (layer.route) {
    const methods = Object.keys(layer.route.methods).join(',');
    console.log(`  ${i}: ROUTE ${methods} ${layer.route.path}`);
  } else {
    console.log(`  ${i}: MIDDLEWARE name="${layer.name}" regexp=${layer.regexp?.toString().substring(0, 60)}`);
  }
});

console.log("\n=== documentsApiRouter state ===");
console.log(`Type: ${typeof documentsApiRouter}`);
console.log(`Stack length: ${(documentsApiRouter as any).stack?.length || 0}`);
