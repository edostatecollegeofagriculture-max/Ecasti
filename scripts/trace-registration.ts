import 'dotenv/config';
import express from 'express';

// Monkey-patch Router prototype methods to log
const routerProto = express.Router();
const methods = ['get', 'post', 'put', 'patch', 'delete', 'use'] as const;
let callCount = 0;

methods.forEach((method) => {
  const original = (routerProto as any)[method].bind(routerProto);
  (routerProto as any)[method] = function (...args: any[]) {
    callCount++;
    const path = args[0];
    const pathStr = typeof path === 'string' ? path : '(middleware)';
    console.log(`[${callCount}] ${method.toUpperCase()} ${pathStr}`);
    return original(...args);
  };
});

// Now load apiRouter — it should use the patched Router
try {
  const { apiRouter } = await import("../server/apiRouter");
  console.log(`\n=== FINAL ===`);
  console.log(`Total routes registered: ${(apiRouter as any).stack.length}`);
} catch (err: any) {
  console.error(`\n=== FAILED AT CALL ${callCount} ===`);
  console.error(`Error: ${err.message}`);
  console.error(err.stack);
}
