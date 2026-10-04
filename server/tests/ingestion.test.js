import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import {
  fetchWeatherForRegion,
  haversineDistanceKm,
  fetchSeismicForRegion,
  parseRiverGaugeCsv,
  fetchRiverForRegion,
  runIngestionCycle,
  startScheduler
} from '../src/ingestion/index.js';
import { Region, Observation } from '../src/models/index.js';
import { config } from '../src/config.js';

const TEST_DB_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/hazard_dashboard_test';

// Sample mock data
const mockWeatherResponse = {
  main: { temp: 29.2, pressure: 998, humidity: 85 },
  wind: { speed: 11.5 },
  rain: { '1h': 3.2 },
  weather: [{ description: 'heavy rainfall' }],
  name: 'Puri'
};

const mockUsgsResponse = {
  type: 'FeatureCollection',
  features: [
    {
      id: 'quake_near_puri',
      properties: {
        mag: 4.5,
        place: '15km E of Puri, India',
        time: Date.now() - 1000 * 60 * 60 * 24
      },
      geometry: {
        type: 'Point',
        // [lon, lat, depth]
        coordinates: [85.90, 19.85, 10]
      }
    },
    {
      id: 'quake_far_away',
      properties: {
        mag: 6.8,
        place: 'Fiji Islands Region',
        time: Date.now() - 1000 * 60 * 60 * 48
      },
      geometry: {
        type: 'Point',
        coordinates: [-178.0, -18.0, 500]
      }
    }
  ]
};

describe('Ingestion Pipeline', () => {
  let sampleRegion;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    config.openWeatherApiKey = 'test_mock_key';

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(TEST_DB_URI);
    await Region.deleteMany({});
    await Observation.deleteMany({});

    sampleRegion = await Region.create({
      name: 'Puri',
      location: { lat: 19.8135, lon: 85.8312 },
      population: 1698737
    });
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  beforeEach(() => {
    // Setup fetch mock for external APIs
    global.fetch = jest.fn((url) => {
      const urlStr = String(url);
      if (urlStr.includes('openweathermap.org')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockWeatherResponse
        });
      }
      if (urlStr.includes('earthquake.usgs.gov')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockUsgsResponse
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Weather Ingestion', () => {
    it('fetches weather and stores an Observation document', async () => {
      const obs = await fetchWeatherForRegion(sampleRegion);

      expect(obs).toBeDefined();
      expect(obs.source).toBe('weather');
      expect(obs.regionId.toString()).toBe(sampleRegion._id.toString());
      expect(obs.payload.temperature).toBe(29.2);
      expect(obs.payload.pressure).toBe(998);
      expect(obs.payload.windSpeed).toBe(11.5);
      expect(obs.payload.rainfall24h).toBe(76.8); // 3.2 * 24
      expect(obs.payload.description).toBe('heavy rainfall');
    });

    it('falls back to last observation when API call fails', async () => {
      // First ensure an existing observation exists
      const existingObs = await Observation.findOne({
        regionId: sampleRegion._id,
        source: 'weather'
      });
      expect(existingObs).toBeDefined();

      // Mock fetch failure
      global.fetch = jest.fn(() => Promise.reject(new Error('Network connection timeout')));

      const fallbackObs = await fetchWeatherForRegion(sampleRegion);
      expect(fallbackObs).toBeDefined();
      expect(fallbackObs._id.toString()).toBe(existingObs._id.toString());
    });
  });

  describe('2. Seismic Ingestion', () => {
    it('calculates haversine distance accurately', () => {
      // Distance between identical coordinates is 0
      const distZero = haversineDistanceKm(19.8135, 85.8312, 19.8135, 85.8312);
      expect(distZero).toBe(0);

      // Distance between Puri and nearby point (~8 km)
      const distNearby = haversineDistanceKm(19.8135, 85.8312, 19.85, 85.90);
      expect(distNearby).toBeGreaterThan(5);
      expect(distNearby).toBeLessThan(15);
    });

    it('filters quakes within 300 km and stores Observation document', async () => {
      const obs = await fetchSeismicForRegion(sampleRegion);

      expect(obs).toBeDefined();
      expect(obs.source).toBe('seismic');
      expect(obs.payload.earthquakesCount).toBe(1);
      expect(obs.payload.maxMagnitude).toBe(4.5);
      expect(obs.payload.earthquakes).toHaveLength(1);
      expect(obs.payload.earthquakes[0].id).toBe('quake_near_puri');
      expect(obs.payload.earthquakes[0].distanceKm).toBeLessThan(300);
    });

    it('falls back to last seismic observation on USGS error', async () => {
      const existingObs = await Observation.findOne({
        regionId: sampleRegion._id,
        source: 'seismic'
      });
      expect(existingObs).toBeDefined();

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable'
        })
      );

      const fallbackObs = await fetchSeismicForRegion(sampleRegion);
      expect(fallbackObs).toBeDefined();
      expect(fallbackObs._id.toString()).toBe(existingObs._id.toString());
    });
  });

  describe('3. River Gauge Ingestion', () => {
    it('parses river_gauge.csv and creates Observation document', async () => {
      const gaugeMap = await parseRiverGaugeCsv();
      expect(gaugeMap.has('Puri')).toBe(true);
      expect(gaugeMap.get('Puri').currentLevel).toBe(4.2);
      expect(gaugeMap.get('Puri').dangerLevel).toBe(6.5);

      const obs = await fetchRiverForRegion(sampleRegion);
      expect(obs).toBeDefined();
      expect(obs.source).toBe('river');
      expect(obs.payload.currentLevel).toBe(4.2);
      expect(obs.payload.dangerLevel).toBe(6.5);
      expect(obs.payload.ratio).toBeCloseTo(4.2 / 6.5, 2);
    });

    it('falls back to last observation on missing gauge data', async () => {
      const existingObs = await Observation.findOne({
        regionId: sampleRegion._id,
        source: 'river'
      });
      expect(existingObs).toBeDefined();

      const unknownRegion = {
        _id: new mongoose.Types.ObjectId(),
        name: 'NonExistentRegion',
        location: { lat: 0, lon: 0 }
      };

      const fallbackObs = await fetchRiverForRegion(unknownRegion);
      // No existing observation for unknownRegion returns null without crashing
      expect(fallbackObs).toBeNull();
    });
  });

  describe('4. Scheduler & Full Cycle', () => {
    it('executes runIngestionCycle across all database regions', async () => {
      const summary = await runIngestionCycle();

      expect(summary.regionsCount).toBe(1);
      expect(summary.weather).toBe(1);
      expect(summary.seismic).toBe(1);
      expect(summary.river).toBe(1);
    });

    it('starts and stops scheduler cleanly', () => {
      const cronTask = startScheduler('*/10 * * * *');
      expect(cronTask).toBeDefined();
      cronTask.stop();
    });
  });
});
