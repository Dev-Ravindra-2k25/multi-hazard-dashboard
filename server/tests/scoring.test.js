import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import {
  floodIndex,
  seismicIndex,
  cyclonIndex,
  cycloneIndex,
  bandFor,
  computeRiskScoreForRegion,
  runScoringCycle
} from '../src/scoring/index.js';
import { Region, Observation, RiskScore, Config } from '../src/models/index.js';

const TEST_DB_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/hazard_dashboard_test';

describe('Scoring Module', () => {
  describe('1. Individual Indices (Pure Calculations)', () => {
    describe('floodIndex', () => {
      it('returns 0 for no rain and zero river level', () => {
        expect(floodIndex({ rainfall24h: 0 }, { currentLevel: 0, dangerLevel: 5 })).toBe(0);
      });

      it('returns 50 for 100mm rainfall (50% max) and 0.5 river ratio (50% max)', () => {
        expect(floodIndex({ rainfall24h: 100 }, { currentLevel: 2.5, dangerLevel: 5 })).toBe(50);
      });

      it('caps rainfall at 200mm and river level at danger level for 100 max', () => {
        expect(floodIndex({ rainfall24h: 350 }, { currentLevel: 8.0, dangerLevel: 5 })).toBe(100);
      });
    });

    describe('seismicIndex', () => {
      it('returns 0 when no quakes or max magnitude <= 2.0', () => {
        expect(seismicIndex({ earthquakes: [] })).toBe(0);
        expect(seismicIndex({ earthquakes: [{ mag: 1.8, time: new Date() }] })).toBe(0);
      });

      it('scales M2 to M7 linearly (M4.5 -> 50, M7.0 -> 100) when recent', () => {
        const now = new Date();
        const scoreM45 = seismicIndex({
          earthquakes: [{ mag: 4.5, time: now }]
        }, now);
        expect(scoreM45).toBe(50);

        const scoreM7 = seismicIndex({
          earthquakes: [{ mag: 7.0, time: now }]
        }, now);
        expect(scoreM7).toBe(100);
      });

      it('decays linearly over 7 days (half decay at 3.5 days, full decay at 7 days)', () => {
        const now = new Date('2026-10-05T12:00:00Z');
        const threePointFiveDaysAgo = new Date(now.getTime() - 3.5 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const halfDecayed = seismicIndex({
          earthquakes: [{ mag: 7.0, time: threePointFiveDaysAgo }]
        }, now);
        expect(halfDecayed).toBe(50);

        const fullyDecayed = seismicIndex({
          earthquakes: [{ mag: 7.0, time: sevenDaysAgo }]
        }, now);
        expect(fullyDecayed).toBe(0);
      });
    });

    describe('cyclonIndex', () => {
      it('returns 0 for calm winds and standard 1013 hPa pressure', () => {
        expect(cyclonIndex({ windSpeed: 0, pressure: 1013 })).toBe(0);
      });

      it('returns 50 for mid-range depression wind and pressure', () => {
        // 20 m/s wind (25 pts) + 988 hPa (25 pts drop from 1013) = 50
        expect(cyclonIndex({ windSpeed: 20, pressure: 988 })).toBe(50);
      });

      it('caps at 100 for extreme hurricane-force winds and deep pressure drop', () => {
        expect(cyclonIndex({ windSpeed: 55, pressure: 940 })).toBe(100);
      });

      it('cycloneIndex alias matches cyclonIndex', () => {
        expect(cycloneIndex({ windSpeed: 20, pressure: 988 })).toBe(50);
      });
    });

    describe('bandFor (Boundaries: 25/26, 50/51, 75/76)', () => {
      it('correctly maps Low band for score <= 25', () => {
        expect(bandFor(0)).toBe('Low');
        expect(bandFor(15)).toBe('Low');
        expect(bandFor(25)).toBe('Low');
      });

      it('correctly maps Moderate band for 25 < score <= 50 (testing boundary 25 vs 26)', () => {
        expect(bandFor(25.1)).toBe('Moderate');
        expect(bandFor(26)).toBe('Moderate');
        expect(bandFor(38)).toBe('Moderate');
        expect(bandFor(50)).toBe('Moderate');
      });

      it('correctly maps High band for 50 < score <= 75 (testing boundary 50 vs 51)', () => {
        expect(bandFor(50.1)).toBe('High');
        expect(bandFor(51)).toBe('High');
        expect(bandFor(65)).toBe('High');
        expect(bandFor(75)).toBe('High');
      });

      it('correctly maps Severe band for score > 75 (testing boundary 75 vs 76)', () => {
        expect(bandFor(75.1)).toBe('Severe');
        expect(bandFor(76)).toBe('Severe');
        expect(bandFor(92)).toBe('Severe');
        expect(bandFor(100)).toBe('Severe');
      });
    });
  });

  describe('2. Scoring Engine & Stale Flag', () => {
    let testRegion;

    beforeAll(async () => {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      await mongoose.connect(TEST_DB_URI);
    });

    afterAll(async () => {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
      }
    });

    beforeEach(async () => {
      await Region.deleteMany({});
      await Observation.deleteMany({});
      await RiskScore.deleteMany({});
      await Config.deleteMany({});

      testRegion = await Region.create({
        name: 'Test Cuttack',
        location: { lat: 20.4625, lon: 85.8828 },
        population: 2624470
      });

      await Config.create({
        key: 'weights',
        value: { flood: 0.4, seismic: 0.3, cyclone: 0.3 }
      });
    });

    it('computes composite score and sets stale: false when all observations are fresh (< 30 min)', async () => {
      const now = new Date();
      // Fresh observations (5 minutes ago)
      const freshTime = new Date(now.getTime() - 5 * 60 * 1000);

      await Observation.create([
        {
          regionId: testRegion._id,
          source: 'weather',
          payload: { windSpeed: 20, pressure: 988, rainfall24h: 100 },
          fetchedAt: freshTime
        },
        {
          regionId: testRegion._id,
          source: 'seismic',
          payload: { earthquakes: [{ mag: 4.5, time: now }] },
          fetchedAt: freshTime
        },
        {
          regionId: testRegion._id,
          source: 'river',
          payload: { currentLevel: 2.5, dangerLevel: 5.0, ratio: 0.5 },
          fetchedAt: freshTime
        }
      ]);

      const score = await computeRiskScoreForRegion(testRegion);

      expect(score).toBeDefined();
      expect(score.stale).toBe(false);
      expect(score.regionId.toString()).toBe(testRegion._id.toString());
      expect(score.floodIdx).toBe(50); // rain: 25, river: 25
      expect(score.seismicIdx).toBe(50);
      expect(score.cyclonIdx).toBe(50);
      // composite = 0.4*50 + 0.3*50 + 0.3*50 = 50
      expect(score.composite).toBe(50);
      expect(score.band).toBe('Moderate');
    });

    it('sets stale: true if any observation is older than 30 minutes', async () => {
      const now = new Date();
      const freshTime = new Date(now.getTime() - 5 * 60 * 1000);
      const staleTime = new Date(now.getTime() - 35 * 60 * 1000); // 35 min ago

      await Observation.create([
        {
          regionId: testRegion._id,
          source: 'weather',
          payload: { windSpeed: 10, pressure: 1010, rainfall24h: 20 },
          fetchedAt: staleTime // STALE!
        },
        {
          regionId: testRegion._id,
          source: 'seismic',
          payload: { earthquakes: [] },
          fetchedAt: freshTime
        },
        {
          regionId: testRegion._id,
          source: 'river',
          payload: { currentLevel: 1.0, dangerLevel: 5.0 },
          fetchedAt: freshTime
        }
      ]);

      const score = await computeRiskScoreForRegion(testRegion);
      expect(score.stale).toBe(true);
    });

    it('sets stale: true if any observation is completely missing', async () => {
      // Only create river observation, weather and seismic missing
      await Observation.create({
        regionId: testRegion._id,
        source: 'river',
        payload: { currentLevel: 1.0, dangerLevel: 5.0 },
        fetchedAt: new Date()
      });

      const score = await computeRiskScoreForRegion(testRegion);
      expect(score.stale).toBe(true);
    });

    it('executes runScoringCycle across all regions in DB', async () => {
      const summary = await runScoringCycle();
      expect(summary.regionsCount).toBe(1);
      expect(summary.scoresCreated).toBe(1);
    });
  });
});
