import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../src/app.js';
import { Region, RiskScore, Shelter, Alert } from '../src/models/index.js';

const TEST_DB_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/hazard_dashboard_test';

describe('Public Read API Routes (/api)', () => {
  let testRegion;
  let testScore;
  let testShelter;
  let testAlert;

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
    await RiskScore.deleteMany({});
    await Shelter.deleteMany({});
    await Alert.deleteMany({});

    testRegion = await Region.create({
      name: 'Puri',
      location: { lat: 19.8135, lon: 85.8312 },
      population: 1698737
    });

    testScore = await RiskScore.create({
      regionId: testRegion._id,
      floodIdx: 45,
      seismicIdx: 30,
      cyclonIdx: 60,
      composite: 45,
      band: 'Moderate',
      stale: false,
      explanation: 'Moderate risk due to cyclone proximity',
      computedAt: new Date()
    });

    testShelter = await Shelter.create({
      regionId: testRegion._id,
      name: 'Puri Beach Relief Shelter',
      location: { lat: 19.815, lon: 85.832 },
      capacity: 500
    });

    testAlert = await Alert.create({
      regionId: testRegion._id,
      message: 'High Cyclone Alert for Puri Coast',
      type: 'manual',
      band: 'High',
      issuedBy: 'Disaster Cell',
      createdAt: new Date()
    });
  });

  describe('GET /api/regions', () => {
    it('returns 200 with list of regions including latest composite and band', async () => {
      const res = await request(app).get('/api/regions');

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);

      const regionItem = res.body[0];
      expect(regionItem.name).toBe('Puri');
      expect(regionItem.composite).toBe(45);
      expect(regionItem.band).toBe('Moderate');
      expect(regionItem.stale).toBe(false);
      expect(regionItem.latestScore).toBeDefined();
      expect(regionItem.latestScore.composite).toBe(45);
    });
  });

  describe('GET /api/regions/:id', () => {
    it('returns 200 with details for existing region', async () => {
      const res = await request(app).get(`/api/regions/${testRegion._id}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.name).toBe('Puri');
      expect(res.body.population).toBe(1698737);
      expect(res.body.location.lat).toBe(19.8135);
      expect(res.body.location.lon).toBe(85.8312);
    });

    it('returns 404 for non-existent valid ObjectId', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/regions/${nonExistentId}`);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error', 'Region not found');
    });

    it('returns 400 for invalid ID format', async () => {
      const res = await request(app).get('/api/regions/not-a-valid-id');

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid region ID format');
    });
  });

  describe('GET /api/regions/:id/score', () => {
    it('returns 200 with latest RiskScore breakdown', async () => {
      const res = await request(app).get(`/api/regions/${testRegion._id}/score`);

      expect(res.statusCode).toBe(200);
      expect(res.body.floodIdx).toBe(45);
      expect(res.body.seismicIdx).toBe(30);
      expect(res.body.cyclonIdx).toBe(60);
      expect(res.body.composite).toBe(45);
      expect(res.body.band).toBe('Moderate');
      expect(res.body.stale).toBe(false);
      expect(res.body).toHaveProperty('computedAt');
    });

    it('returns 404 when region exists but has no risk score yet', async () => {
      const regionWithoutScore = await Region.create({
        name: 'Chamoli',
        location: { lat: 30.4227, lon: 79.3283 },
        population: 391605
      });

      const res = await request(app).get(`/api/regions/${regionWithoutScore._id}/score`);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error', 'No risk score found for this region');
    });

    it('returns 404 for non-existent region ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/regions/${nonExistentId}/score`);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error', 'Region not found');
    });

    it('returns 400 for invalid ID format', async () => {
      const res = await request(app).get('/api/regions/invalid-id-123/score');

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid region ID format');
    });
  });

  describe('GET /api/regions/:id/shelters', () => {
    it('returns 200 with array of shelters for the region', async () => {
      const res = await request(app).get(`/api/regions/${testRegion._id}/shelters`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe('Puri Beach Relief Shelter');
      expect(res.body[0].capacity).toBe(500);
    });

    it('returns 404 for non-existent region ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/regions/${nonExistentId}/shelters`);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error', 'Region not found');
    });

    it('returns 400 for invalid ID format', async () => {
      const res = await request(app).get('/api/regions/bad-id/shelters');

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid region ID format');
    });
  });

  describe('GET /api/alerts', () => {
    it('returns 200 with newest alerts up to 50', async () => {
      const res = await request(app).get('/api/alerts');

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].message).toBe('High Cyclone Alert for Puri Coast');
      expect(res.body[0].type).toBe('manual');
      expect(res.body[0].band).toBe('High');
    });

    it('filters alerts by valid ?regionId=', async () => {
      const otherRegion = await Region.create({
        name: 'Chennai',
        location: { lat: 13.0827, lon: 80.2707 },
        population: 7088403
      });

      await Alert.create({
        regionId: otherRegion._id,
        message: 'Chennai Rain Warning',
        type: 'auto',
        band: 'Moderate',
        issuedBy: 'system'
      });

      const resFiltered = await request(app).get(`/api/alerts?regionId=${testRegion._id}`);
      expect(resFiltered.statusCode).toBe(200);
      expect(resFiltered.body.length).toBe(1);
      expect(resFiltered.body[0].regionId.toString()).toBe(testRegion._id.toString());
      expect(resFiltered.body[0].message).toBe('High Cyclone Alert for Puri Coast');
    });

    it('returns 400 when ?regionId= is an invalid ID format', async () => {
      const res = await request(app).get('/api/alerts?regionId=not-valid-id');

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid region ID format');
    });
  });
});
