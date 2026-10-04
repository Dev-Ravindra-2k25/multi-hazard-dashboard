import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import regionsRouter from './routes/regions.js';
import alertsRouter from './routes/alerts.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.clientUrl }));
  app.use(express.json());

  // Health route
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

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // Error handler
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || 'Internal Server Error'
    });
  });

  return app;
}

export const app = createApp();
export default app;
