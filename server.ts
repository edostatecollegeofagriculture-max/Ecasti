import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/apiRouter';
import { feeApiRouter } from './server/feeApiRouter';
import { neonPool } from './server/neon';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function configureCors(app: express.Express) {
  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    }

    if (req.method === 'OPTIONS') {
      if (origin && !allowedOrigins.includes(origin)) {
        return res.status(403).end();
      }

      return res.status(204).end();
    }

    return next();
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Vercel hosts the frontend; Render hosts this API. Only explicitly
  // configured frontend origins are allowed to make browser API calls.
  configureCors(app);

  // JSON request body parser (supports image uploads)
  app.use(express.json({ limit: '15mb' }));

  // Mount API endpoints
  app.use('/api/v1', apiRouter);
  app.use('/api/v1/fees', feeApiRouter);

  // Health check endpoint
  app.get('/api/health', async (_req, res) => {
    try {
      await neonPool.query('SELECT 1');
      return res.status(200).json({
        status: 'UP',
        database: 'CONNECTED',
        service: 'EDOCASTI School Portal API',
        timestamp: new Date().toISOString(),
      });
    } catch {
      return res.status(503).json({
        status: 'DEGRADED',
        database: 'UNAVAILABLE',
        service: 'EDOCASTI School Portal API',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Local development serves the Vite app. In production, Vercel serves
  // the frontend independently and Render serves the API.
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (process.env.SERVE_FRONTEND === 'true') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[EDOCASTI] API listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting EDOCASTI API:', err);
  process.exit(1);
});
