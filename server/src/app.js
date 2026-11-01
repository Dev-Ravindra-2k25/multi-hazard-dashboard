import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, getAllowedOrigins } from './config.js';
import regionsRouter from './routes/regions.js';
import alertsRouter from './routes/alerts.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import exportRouter from './routes/export.js';
import aiRouter from './routes/ai.js';

export function createApp(customRoutes = null) {
  const app = express();

  // (3) Trust proxy for real client IP extraction behind reverse proxies (e.g. Render)
  app.set('trust proxy', 1);

  // (1) Security headers with helmet
  app.use(helmet());

  // (2) Dynamic CORS with allowed origins list
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. curl, server-to-server, native)
        if (!origin) return callback(null, true);

        const allowed = getAllowedOrigins(process.env);
        if (allowed.includes(origin)) {
          return callback(null, true);
        }

        const corsErr = new Error(`CORS blocked for origin: ${origin}`);
        corsErr.status = 403;
        return callback(corsErr);
      },
      credentials: true
    })
  );

  app.use(express.json());

  // Health check route
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // API routes
  app.use('/api/auth', authRouter);
  app.use('/api/regions', regionsRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/export', exportRouter);
  app.use('/api/ai', aiRouter);

  if (typeof customRoutes === 'function') {
    customRoutes(app);
  }

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // (5) Production error handler: logs server-side only, never sends stack traces
  app.use((err, req, res, next) => {
    console.error('[Error Handler]', err.message || err);

    const status = err.status || 500;
    const isProduction = process.env.NODE_ENV === 'production' || config.nodeEnv === 'production';

    if (isProduction) {
      const message = status < 500 ? (err.message || 'Bad Request') : 'Internal Server Error';
      return res.status(status).json({ error: message });
    }

    return res.status(status).json({
      error: err.message || 'Internal Server Error',
      ...(err.stack ? { stack: err.stack } : {})
    });
  });

  return app;
}

export const app = createApp();
export default app;
