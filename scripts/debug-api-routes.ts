import 'dotenv/config';
import { apiRouter } from "../server/apiRouter";

const routes: string[] = [];
(apiRouter as any).stack.forEach((layer: any) => {
  if (layer.route) {
    const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
    routes.push(`${methods} ${layer.route.path}`);
  }
});

console.log(`Total routes: ${routes.length}`);
console.log(`JWT_SECRET present: ${!!process.env.JWT_SECRET}`);
console.log(`JWT_SECRET length: ${process.env.JWT_SECRET?.length || 0}`);
console.log(`settings route: ${routes.some((r) => r.includes('/settings'))}`);
console.log(`cms/news route: ${routes.some((r) => r.includes('/cms/news'))}`);
