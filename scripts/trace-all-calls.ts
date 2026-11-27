import 'dotenv/config';

// Patch express.Router BEFORE importing apiRouter
const express = await import('express');
const originalRouter = express.Router;

const LoggingRouter = function () {
  const router = originalRouter();
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'use'];
  
  methods.forEach((method) => {
    const original = (router as any)[method].bind(router);
    (router as any)[method] = function (...args: any[]) {
      const pathStr = typeof args[0] === 'string' ? args[0] : '(middleware)';
      console.log(`[${method.toUpperCase()}] ${pathStr}`);
      return original(...args);
    };
  });
  
  return router;
};

(express as any).Router = LoggingRouter;

// Now import apiRouter — should use our logging router
try {
  const { apiRouter } = await import("../server/apiRouter");
  console.log(`\n=== COMPLETE ===`);
  console.log(`Total layers: ${(apiRouter as any).stack.length}`);
} catch (err: any) {
  console.error(`\n=== FAILED ===`);
  console.error(`Error: ${err.message}`);
  console.error(err.stack);
}
