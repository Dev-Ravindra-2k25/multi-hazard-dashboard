import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Observation } from '../models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_CSV_PATH = path.join(__dirname, '../../seed/river_gauge.csv');

export async function parseRiverGaugeCsv(csvPath = DEFAULT_CSV_PATH) {
  const content = await fs.readFile(csvPath, 'utf-8');
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const gaugeMap = new Map();
  // Skip header if first line contains regionName
  const startIndex = lines[0].toLowerCase().includes('regionname') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split(',').map((p) => p.trim());
    if (parts.length >= 3) {
      const [regionName, currentLevelStr, dangerLevelStr, unit] = parts;
      const currentLevel = parseFloat(currentLevelStr);
      const dangerLevel = parseFloat(dangerLevelStr);

      if (!isNaN(currentLevel) && !isNaN(dangerLevel)) {
        gaugeMap.set(regionName, {
          currentLevel,
          dangerLevel,
          unit: unit || 'm',
          ratio: dangerLevel > 0 ? Math.round((currentLevel / dangerLevel) * 1000) / 1000 : 0
        });
      }
    }
  }

  return gaugeMap;
}

export async function fetchRiverForRegion(region, cachedGaugeMap = null, csvPath = DEFAULT_CSV_PATH) {
  try {
    const gaugeMap = cachedGaugeMap || (await parseRiverGaugeCsv(csvPath));
    const gauge = gaugeMap.get(region.name);

    if (!gauge) {
      throw new Error(`No river gauge data found for region: ${region.name}`);
    }

    const payload = {
      stationName: `${region.name} Gauge Station`,
      currentLevel: gauge.currentLevel,
      dangerLevel: gauge.dangerLevel,
      unit: gauge.unit,
      ratio: gauge.ratio
    };

    return await Observation.create({
      regionId: region._id,
      source: 'river',
      payload,
      fetchedAt: new Date()
    });
  } catch (error) {
    console.error(`River gauge ingestion error for region ${region.name}:`, error.message);

    // Keep and return last Observation instead of crashing
    const lastObs = await Observation.findOne({
      regionId: region._id,
      source: 'river'
    }).sort({ fetchedAt: -1 });

    return lastObs;
  }
}

export async function ingestAllRiver(regions, csvPath = DEFAULT_CSV_PATH) {
  try {
    const gaugeMap = await parseRiverGaugeCsv(csvPath);
    const results = [];
    for (const region of regions) {
      const obs = await fetchRiverForRegion(region, gaugeMap, csvPath);
      if (obs) results.push(obs);
    }
    return results;
  } catch (error) {
    console.error('Failed to parse river gauge CSV for all regions:', error.message);
    const results = [];
    for (const region of regions) {
      const lastObs = await Observation.findOne({
        regionId: region._id,
        source: 'river'
      }).sort({ fetchedAt: -1 });
      if (lastObs) results.push(lastObs);
    }
    return results;
  }
}
