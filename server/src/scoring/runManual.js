import mongoose from 'mongoose';
import { config } from '../config.js';
import { runScoringCycle } from './engine.js';

async function main() {
  try {
    console.log(`Connecting to MongoDB at ${config.mongodbUri}...`);
    await mongoose.connect(config.mongodbUri);
    const summary = await runScoringCycle();
    console.log('Manual scoring completed:', summary);
    process.exit(0);
  } catch (error) {
    console.error('Manual scoring failed:', error);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

main();
