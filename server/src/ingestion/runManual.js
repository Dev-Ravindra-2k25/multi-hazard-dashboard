import mongoose from 'mongoose';
import { config } from '../config.js';
import { runIngestionCycle } from './scheduler.js';

async function main() {
  try {
    console.log(`Connecting to MongoDB at ${config.mongodbUri}...`);
    await mongoose.connect(config.mongodbUri);
    const summary = await runIngestionCycle();
    console.log('Manual ingestion completed:', summary);
    process.exit(0);
  } catch (error) {
    console.error('Manual ingestion failed:', error);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

main();
