import { Region, Observation, RiskScore, Config } from '../models/index.js';
import { floodIndex, seismicIndex, cyclonIndex, bandFor } from './indices.js';

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const DEFAULT_WEIGHTS = { flood: 0.4, seismic: 0.3, cyclone: 0.3 };

/**
 * Computes and saves a RiskScore document for a given region.
 * Checks Observation age against 30 minutes threshold to set the stale flag.
 */
export async function computeRiskScoreForRegion(region, cachedWeights = null) {
  const now = new Date();

  // 1. Fetch latest Observation of each source
  const [weatherObs, seismicObs, riverObs] = await Promise.all([
    Observation.findOne({ regionId: region._id, source: 'weather' }).sort({ fetchedAt: -1 }),
    Observation.findOne({ regionId: region._id, source: 'seismic' }).sort({ fetchedAt: -1 }),
    Observation.findOne({ regionId: region._id, source: 'river' }).sort({ fetchedAt: -1 })
  ]);

  // 2. Check if any observation is missing or older than 30 minutes
  const isWeatherStale = !weatherObs || (now - new Date(weatherObs.fetchedAt)) > THIRTY_MINUTES_MS;
  const isSeismicStale = !seismicObs || (now - new Date(seismicObs.fetchedAt)) > THIRTY_MINUTES_MS;
  const isRiverStale = !riverObs || (now - new Date(riverObs.fetchedAt)) > THIRTY_MINUTES_MS;

  const stale = isWeatherStale || isSeismicStale || isRiverStale;

  // 3. Compute individual hazard indices
  const floodIdx = floodIndex(weatherObs?.payload, riverObs?.payload);
  const seismicIdx = seismicIndex(seismicObs?.payload, now);
  const cyclonIdx = cyclonIndex(weatherObs?.payload);

  // 4. Resolve weights
  let weights = cachedWeights;
  if (!weights) {
    const weightsConfig = await Config.findOne({ key: 'weights' });
    weights = weightsConfig?.value || DEFAULT_WEIGHTS;
  }

  const wFlood = typeof weights.flood === 'number' ? weights.flood : DEFAULT_WEIGHTS.flood;
  const wSeismic = typeof weights.seismic === 'number' ? weights.seismic : DEFAULT_WEIGHTS.seismic;
  const wCyclone = typeof weights.cyclone === 'number' ? weights.cyclone : DEFAULT_WEIGHTS.cyclone;

  // 5. Calculate composite score and risk band
  const rawComposite = wFlood * floodIdx + wSeismic * seismicIdx + wCyclone * cyclonIdx;
  const composite = Math.round(Math.min(Math.max(rawComposite, 0), 100) * 100) / 100;
  const band = bandFor(composite);

  // 6. Save RiskScore document
  const riskScore = await RiskScore.create({
    regionId: region._id,
    floodIdx,
    seismicIdx,
    cyclonIdx,
    composite,
    band,
    stale,
    computedAt: now
  });

  return riskScore;
}

/**
 * Runs a scoring cycle across all monitored regions in the database.
 */
export async function runScoringCycle() {
  console.log(`[Scoring] Starting scoring cycle at ${new Date().toISOString()}`);
  const regions = await Region.find();

  if (regions.length === 0) {
    console.warn('[Scoring] No regions available for scoring.');
    return {
      timestamp: new Date().toISOString(),
      regionsCount: 0,
      scoresCreated: 0,
      staleCount: 0
    };
  }

  const weightsConfig = await Config.findOne({ key: 'weights' });
  const weights = weightsConfig?.value || DEFAULT_WEIGHTS;

  let staleCount = 0;
  const results = [];

  for (const region of regions) {
    try {
      const score = await computeRiskScoreForRegion(region, weights);
      if (score.stale) staleCount++;
      results.push(score);
    } catch (err) {
      console.error(`[Scoring] Error computing score for region ${region.name}:`, err.message);
    }
  }

  const summary = {
    timestamp: new Date().toISOString(),
    regionsCount: regions.length,
    scoresCreated: results.length,
    staleCount
  };

  console.log('[Scoring] Cycle completed successfully:', summary);
  return summary;
}
