import express from 'express';
import cors from 'cors';
import { config } from './config.js';

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
