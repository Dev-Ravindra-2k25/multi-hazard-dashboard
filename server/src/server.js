import mongoose from 'mongoose';
import { app } from './app.js';
import { config } from './config.js';
import { startScheduler } from './ingestion/scheduler.js';

async function startServer() {
  try {
    await mongoose.connect(config.mongodbUri);
    console.log(`Connected to MongoDB at ${config.mongodbUri}`);

    startScheduler();

    const server = app.listen(config.port, () => {
      console.log(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
    });

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

const server = startServer();
export default server;
