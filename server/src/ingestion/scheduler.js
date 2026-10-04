import cron from 'node-cron';
import { Region } from '../models/index.js';
import { ingestAllWeather } from './weather.js';
import { ingestAllSeismic } from './seismic.js';
import { ingestAllRiver } from './river.js';
import { runScoringCycle } from '../scoring/engine.js';

export async function runIngestionCycle() {
  console.log(`[Ingestion] Starting ingestion cycle at ${new Date().toISOString()}`);
  const regions = await Region.find();

  if (regions.length === 0) {
    console.warn('[Ingestion] No regions found to ingest data for.');
    return {
      timestamp: new Date().toISOString(),
      regionsCount: 0,
      weather: 0,
      seismic: 0,
      river: 0,
      scoring: null
    };
  }

  // Run all three pipelines for every region
  const [weatherResults, seismicResults, riverResults] = await Promise.all([
    ingestAllWeather(regions).catch((err) => {
      console.error('[Ingestion] Weather pipeline error:', err.message);
      return [];
    }),
    ingestAllSeismic(regions).catch((err) => {
      console.error('[Ingestion] Seismic pipeline error:', err.message);
      return [];
    }),
    ingestAllRiver(regions).catch((err) => {
      console.error('[Ingestion] River pipeline error:', err.message);
      return [];
    })
  ]);

  // Hook scoring engine right after ingestion
  let scoringSummary = null;
  try {
    scoringSummary = await runScoringCycle();
  } catch (err) {
    console.error('[Ingestion] Error running scoring cycle:', err.message);
  }

  const summary = {
    timestamp: new Date().toISOString(),
    regionsCount: regions.length,
    weather: weatherResults.length,
    seismic: seismicResults.length,
    river: riverResults.length,
    scoring: scoringSummary
  };

  console.log('[Ingestion] Cycle finished successfully with scoring:', summary);
  return summary;
}

export function startScheduler(cronExpression = '*/10 * * * *') {
  console.log(`[Scheduler] Initializing cron job: "${cronExpression}"`);
  const task = cron.schedule(cronExpression, async () => {
    try {
      await runIngestionCycle();
    } catch (err) {
      console.error('[Scheduler] Error during scheduled cycle:', err.message);
    }
  });

  return task;
}
