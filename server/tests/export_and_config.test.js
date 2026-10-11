import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { Region, RiskScore, Observation, Config, User } from '../src/models/index.js';
import { config } from '../src/config.js';
import { computeRiskScoreForRegion } from '../src/scoring/engine.js';
import { bandFor } from '../src/scoring/indices.js';

const TEST_DB_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/hazard_dashboard_test';

describe('Slice 9: CSV Export & Admin Settings API', () => {
  let adminToken;
  let citizenToken;
  let sampleRegion;
  let specialRegion;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(TEST_DB_URI);

    // Create admin user and JWT
    const adminUser = await User.create({
      email: 'admin_test@hazard.gov.in',
      passwordHash: 'dummyhash',
      role: 'admin'
    });
    adminToken = jwt.sign(
      { id: adminUser._id, email: adminUser.email, role: 'admin' },
      config.jwtSecret,
      { expiresIn: '8h' }
    );

    // Create citizen user and JWT
    const citizenUser = await User.create({
      email: 'citizen_test@hazard.gov.in',
      passwordHash: 'dummyhash',
      role: 'citizen'
    });
    citizenToken = jwt.sign(
      { id: citizenUser._id, email: citizenUser.email, role: 'citizen' },
      config.jwtSecret,
      { expiresIn: '8h' }
    );
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    await Region.deleteMany({});
    await RiskScore.deleteMany({});
    await Observation.deleteMany({});
    await Config.deleteMany({});

    // Standard test region
    sampleRegion = await Region.create({
      name: 'Puri',
      location: { lat: 19.8135, lon: 85.8312 },
      population: 1698737
    });

    // Special region with commas and quotes in name for CSV escaping test
    specialRegion = await Region.create({
      name: 'South "Coastal", Zone',
      location: { lat: 11.93, lon: 79.83 },
      population: 500000
    });
  });

  describe('GET /api/export/scores.csv (Public Export)', () => {
    it('returns 200 with correct CSV headers and header row', async () => {
      const now = new Date();
      await RiskScore.create({
        regionId: sampleRegion._id,
        floodIdx: 40,
        seismicIdx: 20,
        cyclonIdx: 60,
        composite: 40,
        band: 'Moderate',
        stale: false,
        computedAt: now
      });

      const res = await request(app).get('/api/export/scores.csv');

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toContain('attachment; filename="scores.csv"');

      const lines = res.text.trim().split('\n');
      expect(lines[0]).toBe('region,computedAt,floodIdx,seismicIdx,cyclonIdx,composite,band,stale');
      expect(lines.length).toBe(2);

      const row = lines[1].split(',');
      expect(row[0]).toBe('Puri');
      expect(row[2]).toBe('40');
      expect(row[3]).toBe('20');
      expect(row[4]).toBe('60');
      expect(row[5]).toBe('40');
      expect(row[6]).toBe('Moderate');
      expect(row[7]).toBe('false');
    });

    it('correctly escapes commas and quotes in region names', async () => {
      const now = new Date();
      await RiskScore.create({
        regionId: specialRegion._id,
        floodIdx: 80,
        seismicIdx: 10,
        cyclonIdx: 90,
        composite: 62,
        band: 'High',
        stale: true,
        computedAt: now
      });

      const res = await request(app).get(`/api/export/scores.csv?regionId=${specialRegion._id}`);

      expect(res.statusCode).toBe(200);
      const lines = res.text.trim().split('\n');
      expect(lines.length).toBe(2);
      // Region name 'South "Coastal", Zone' must be escaped as '"South ""Coastal"", Zone"'
      expect(lines[1]).toMatch(/^"South ""Coastal"", Zone",/);
      expect(lines[1]).toContain(',true');
    });

    it('applies date filters (?from= and ?to=) and defaults to last 30 days', async () => {
      const now = new Date();
      const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      await RiskScore.create([
        {
          regionId: sampleRegion._id,
          floodIdx: 10,
          seismicIdx: 10,
          cyclonIdx: 10,
          composite: 10,
          band: 'Low',
          stale: false,
          computedAt: fortyDaysAgo
        },
        {
          regionId: sampleRegion._id,
          floodIdx: 50,
          seismicIdx: 50,
          cyclonIdx: 50,
          composite: 50,
          band: 'Moderate',
          stale: false,
          computedAt: fifteenDaysAgo
        },
        {
          regionId: sampleRegion._id,
          floodIdx: 90,
          seismicIdx: 90,
          cyclonIdx: 90,
          composite: 90,
          band: 'Severe',
          stale: false,
          computedAt: twoDaysAgo
        }
      ]);

      // 1. Default (last 30 days): fortyDaysAgo should be excluded, fifteenDaysAgo & twoDaysAgo included
      const defaultRes = await request(app).get('/api/export/scores.csv');
      expect(defaultRes.statusCode).toBe(200);
      const defaultLines = defaultRes.text.trim().split('\n');
      expect(defaultLines.length).toBe(3); // header + 2 rows

      // 2. Filter from 20 days ago to 10 days ago: only fifteenDaysAgo included
      const fromParam = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
      const toParam = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

      const filteredRes = await request(app).get(`/api/export/scores.csv?from=${fromParam}&to=${toParam}`);
      expect(filteredRes.statusCode).toBe(200);
      const filteredLines = filteredRes.text.trim().split('\n');
      expect(filteredLines.length).toBe(2); // header + 1 row
      expect(filteredLines[1]).toContain(',50,50,50,50,Moderate,false');
    });

    it('returns 400 for invalid dates or region ids', async () => {
      // Invalid from date
      const res1 = await request(app).get('/api/export/scores.csv?from=invalid-date');
      expect(res1.statusCode).toBe(400);
      expect(res1.body).toHaveProperty('error');

      // Invalid to date
      const res2 = await request(app).get('/api/export/scores.csv?to=invalid-date');
      expect(res2.statusCode).toBe(400);
      expect(res2.body).toHaveProperty('error');

      // From date greater than To date
      const res3 = await request(app).get('/api/export/scores.csv?from=2026-10-15&to=2026-10-01');
      expect(res3.statusCode).toBe(400);
      expect(res3.body).toHaveProperty('error');

      // Invalid regionId format
      const res4 = await request(app).get('/api/export/scores.csv?regionId=invalid123');
      expect(res4.statusCode).toBe(400);
      expect(res4.body).toHaveProperty('error');

      // Non-existent regionId
      const res5 = await request(app).get('/api/export/scores.csv?regionId=507f1f77bcf86cd799439011');
      expect(res5.statusCode).toBe(400);
      expect(res5.body).toHaveProperty('error');
    });
  });

  describe('Admin Config API (/api/admin/config)', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const getRes = await request(app).get('/api/admin/config');
      expect(getRes.statusCode).toBe(401);

      const putRes = await request(app).put('/api/admin/config').send({
        weights: { flood: 0.4, seismic: 0.3, cyclone: 0.3 },
        thresholds: [25, 50, 75]
      });
      expect(putRes.statusCode).toBe(401);
    });

    it('returns 403 when authenticated as a non-admin citizen', async () => {
      const getRes = await request(app)
        .get('/api/admin/config')
        .set('Authorization', `Bearer ${citizenToken}`);
      expect(getRes.statusCode).toBe(403);

      const putRes = await request(app)
        .put('/api/admin/config')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          weights: { flood: 0.4, seismic: 0.3, cyclone: 0.3 },
          thresholds: [25, 50, 75]
        });
      expect(putRes.statusCode).toBe(403);
    });

    it('returns 200 with default config for admin when no custom config is saved', async () => {
      const res = await request(app)
        .get('/api/admin/config')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        weights: { flood: 0.4, seismic: 0.3, cyclone: 0.3 },
        thresholds: [25, 50, 75]
      });
    });

    it('validates that weights sum to 1 (tolerance 0.001)', async () => {
      // Sum = 1.5
      const res1 = await request(app)
        .put('/api/admin/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          weights: { flood: 0.5, seismic: 0.5, cyclone: 0.5 },
          thresholds: [25, 50, 75]
        });
      expect(res1.statusCode).toBe(400);
      expect(res1.body.error).toMatch(/Weights must sum to 1/i);

      // Sum = 0.95 (difference 0.05 > 0.001)
      const res2 = await request(app)
        .put('/api/admin/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          weights: { flood: 0.35, seismic: 0.3, cyclone: 0.3 },
          thresholds: [25, 50, 75]
        });
      expect(res2.statusCode).toBe(400);
      expect(res2.body.error).toMatch(/Weights must sum to 1/i);

      // Negative weight
      const res3 = await request(app)
        .put('/api/admin/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          weights: { flood: -0.1, seismic: 0.6, cyclone: 0.5 },
          thresholds: [25, 50, 75]
        });
      expect(res3.statusCode).toBe(400);

      // Weight > 1
      const res4 = await request(app)
        .put('/api/admin/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          weights: { flood: 1.2, seismic: -0.1, cyclone: -0.1 },
          thresholds: [25, 50, 75]
        });
      expect(res4.statusCode).toBe(400);
    });

    it('validates that thresholds are strictly ascending numbers within 0-100', async () => {
      // Non-ascending [50, 25, 75]
      const res1 = await request(app)
        .put('/api/admin/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          weights: { flood: 0.4, seismic: 0.3, cyclone: 0.3 },
          thresholds: [50, 25, 75]
        });
      expect(res1.statusCode).toBe(400);
      expect(res1.body.error).toMatch(/ascending/i);

      // Number > 100
      const res2 = await request(app)
        .put('/api/admin/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          weights: { flood: 0.4, seismic: 0.3, cyclone: 0.3 },
          thresholds: [25, 50, 110]
        });
      expect(res2.statusCode).toBe(400);

      // Not 3 values
      const res3 = await request(app)
        .put('/api/admin/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          weights: { flood: 0.4, seismic: 0.3, cyclone: 0.3 },
          thresholds: [25, 50]
        });
      expect(res3.statusCode).toBe(400);
    });

    it('updates config successfully when inputs are valid', async () => {
      const putRes = await request(app)
        .put('/api/admin/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          weights: { flood: 0.5, seismic: 0.25, cyclone: 0.25 },
          thresholds: [20, 45, 70]
        });

      expect(putRes.statusCode).toBe(200);
      expect(putRes.body).toEqual({
        weights: { flood: 0.5, seismic: 0.25, cyclone: 0.25 },
        thresholds: [20, 45, 70]
      });

      // Verify GET returns the newly saved config
      const getRes = await request(app)
        .get('/api/admin/config')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.statusCode).toBe(200);
      expect(getRes.body).toEqual({
        weights: { flood: 0.5, seismic: 0.25, cyclone: 0.25 },
        thresholds: [20, 45, 70]
      });
    });
  });

  describe('Scoring Engine with Dynamic Config', () => {
    it('changes the composite score when weights are changed in the Config collection', async () => {
      // Create observations for sampleRegion:
      // High rainfall: 200mm -> floodIdx = 50 (if river is 0)
      // Wind speed 40 m/s -> cyclonIdx = 50
      await Observation.create([
        {
          regionId: sampleRegion._id,
          source: 'weather',
          payload: { rainfall24h: 200, windSpeed: 0, pressure: 1013 },
          fetchedAt: new Date()
        },
        {
          regionId: sampleRegion._id,
          source: 'seismic',
          payload: { maxMagnitude: 0 },
          fetchedAt: new Date()
        },
        {
          regionId: sampleRegion._id,
          source: 'river',
          payload: { ratio: 0 },
          fetchedAt: new Date()
        }
      ]);

      // 1. Compute with default weights (flood: 0.4, seismic: 0.3, cyclone: 0.3)
      // floodIdx = 50, seismic = 0, cyclone = 0 -> composite = 0.4 * 50 = 20
      const score1 = await computeRiskScoreForRegion(sampleRegion);
      expect(score1.composite).toBe(20);
      expect(score1.band).toBe('Low');

      // 2. Update weights in Config: make flood weight 0.8
      await Config.findOneAndUpdate(
        { key: 'weights' },
        { value: { flood: 0.8, seismic: 0.1, cyclone: 0.1 } },
        { upsert: true }
      );

      // Re-compute: composite should now be 0.8 * 50 = 40
      const score2 = await computeRiskScoreForRegion(sampleRegion);
      expect(score2.composite).toBe(40);
      expect(score2.composite).not.toBe(score1.composite);

      // 3. Update thresholds in Config: make low cutoff 15, moderate cutoff 35, high cutoff 60
      await Config.findOneAndUpdate(
        { key: 'thresholds' },
        { value: [15, 35, 60] },
        { upsert: true }
      );

      // Re-compute with composite 40: since 40 is between 35 and 60, band should be High!
      const score3 = await computeRiskScoreForRegion(sampleRegion);
      expect(score3.composite).toBe(40);
      expect(score3.band).toBe('High');
    });

    it('bandFor accepts custom thresholds while preserving default boundaries', async () => {
      // Default: [25, 50, 75]
      expect(bandFor(25)).toBe('Low');
      expect(bandFor(26)).toBe('Moderate');
      expect(bandFor(50)).toBe('Moderate');
      expect(bandFor(51)).toBe('High');
      expect(bandFor(75)).toBe('High');
      expect(bandFor(76)).toBe('Severe');

      // Custom thresholds: [10, 30, 60]
      expect(bandFor(10, [10, 30, 60])).toBe('Low');
      expect(bandFor(11, [10, 30, 60])).toBe('Moderate');
      expect(bandFor(30, [10, 30, 60])).toBe('Moderate');
      expect(bandFor(31, [10, 30, 60])).toBe('High');
      expect(bandFor(60, [10, 30, 60])).toBe('High');
      expect(bandFor(61, [10, 30, 60])).toBe('Severe');
    });
  });
});
