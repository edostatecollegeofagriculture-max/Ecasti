import 'dotenv/config';

// Monkey-patch Router to log each route registration
const express = await import('express');
const originalGet = express.Router().get.bind(express.Router());

const { apiRouter } = await import("../server/apiRouter");

// Count routes at each layer
const stack = (apiRouter as any).stack;
console.log(`\nTotal layers: ${stack.length}`);

let routeCount = 0;
let middlewareCount = 0;
for (const layer of stack) {
  if (layer.route) routeCount++;
  else middlewareCount++;
}
console.log(`Routes: ${routeCount}, Middleware: ${middlewareCount}`);

// If only 6 layers, the rest never registered
// Let's inspect each layer's details
stack.forEach((layer: any, i: number) => {
  if (layer.route) {
    const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
    console.log(`  ${i}: ROUTE ${methods} ${layer.route.path}`);
  } else {
    console.log(`  ${i}: MIDDLEWARE ${layer.name} (handle: ${typeof layer.handle})`);
  }
});
