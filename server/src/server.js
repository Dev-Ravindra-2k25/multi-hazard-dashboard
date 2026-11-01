import mongoose from 'mongoose';
import { app } from './app.js';
import { config, validateStartupConfig } from './config.js';
import { startScheduler, runIngestionCycle } from './ingestion/scheduler.js';
import { RiskScore } from './models/index.js';

async function startServer() {
  try {
    // (4) Fail fast at startup if MongoDB URI or JWT_SECRET (in production) is invalid
    validateStartupConfig(process.env);

    await mongoose.connect(config.mongodbUri);
    // (6) Make sure no secret or API key is ever logged
    console.log('Connected to MongoDB successfully');

    startScheduler();

    const server = app.listen(config.port, () => {
      console.log(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
    });

    // (8) Cold-start catch-up:
    // If the newest RiskScore is older than 15 minutes (or none exists),
    // run one ingestion + scoring cycle in the background, wrapped in try/catch.
    (async () => {
      try {
        const newestScore = await RiskScore.findOne().sort({ computedAt: -1 }).lean();
        const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
        const isOlderThan15m =
          !newestScore ||
          !newestScore.computedAt ||
          new Date(newestScore.computedAt).getTime() < fifteenMinutesAgo;

        if (isOlderThan15m) {
          console.log('[Cold-Start Catch-up] Risk scores missing or older than 15 min. Starting catch-up cycle...');
          await runIngestionCycle();
          console.log('[Cold-Start Catch-up] Initial catch-up cycle completed.');
        }
      } catch (catchUpErr) {
        console.error('[Cold-Start Catch-up] Non-critical catch-up cycle error:', catchUpErr.message);
      }
    })();

    return server;
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

const server = startServer();
export default server;
