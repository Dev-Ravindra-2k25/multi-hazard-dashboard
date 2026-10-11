import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { Region, RiskScore, Alert, User, Observation } from '../src/models/index.js';
import { createAutoAlert, notifyAlert } from '../src/services/alerts.js';
import { computeRiskScoreForRegion } from '../src/scoring/engine.js';
import { config } from '../src/config.js';

const TEST_DB_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/hazard_dashboard_test';

describe('Slice 8: Alerts (Auto & Manual Alerts, Notifier, Filtering)', () => {
  let sampleRegion;
  let adminUser;
  let citizenUser;
  let adminToken;
  let citizenToken;

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
    await Alert.deleteMany({});
    await User.deleteMany({});
    await Observation.deleteMany({});

    sampleRegion = await Region.create({
      name: 'Puri',
      location: { lat: 19.8135, lon: 85.8312 },
      population: 1698737
    });

    adminUser = await User.create({
      email: 'admin@hazard.gov.in',
      passwordHash: 'dummyhash',
      role: 'admin'
    });

    citizenUser = await User.create({
      email: 'citizen@hazard.gov.in',
      passwordHash: 'dummyhash',
      role: 'citizen'
    });

    adminToken = jwt.sign(
      { id: adminUser._id, email: adminUser.email, role: 'admin' },
      config.jwtSecret,
      { expiresIn: '8h' }
    );

    citizenToken = jwt.sign(
      { id: citizenUser._id, email: citizenUser.email, role: 'citizen' },
      config.jwtSecret,
      { expiresIn: '8h' }
    );
  });

  describe('1. Auto Alert Service (createAutoAlert)', () => {
    it('creates an auto alert when band moves up into High', async () => {
      const alert = await createAutoAlert(sampleRegion._id, 'High', 'Moderate');

      expect(alert).not.toBeNull();
      expect(alert.regionId.toString()).toBe(sampleRegion._id.toString());
      expect(alert.type).toBe('auto');
      expect(alert.band).toBe('High');
      expect(alert.issuedBy).toBe('system');
      expect(alert.message).toContain('Puri');
      expect(alert.createdAt).toBeDefined();

      const saved = await Alert.findById(alert._id);
      expect(saved).not.toBeNull();
    });

    it('creates an auto alert when band moves up from High to Severe', async () => {
      const alert = await createAutoAlert(sampleRegion._id, 'Severe', 'High');

      expect(alert).not.toBeNull();
      expect(alert.type).toBe('auto');
      expect(alert.band).toBe('Severe');
    });

    it('creates an auto alert when band moves up from Low to Severe', async () => {
      const alert = await createAutoAlert(sampleRegion._id, 'Severe', 'Low');

      expect(alert).not.toBeNull();
      expect(alert.type).toBe('auto');
      expect(alert.band).toBe('Severe');
    });

    it('does NOT create an alert when band stays the same (High -> High)', async () => {
      const alert = await createAutoAlert(sampleRegion._id, 'High', 'High');

      expect(alert).toBeNull();
      const count = await Alert.countDocuments();
      expect(count).toBe(0);
    });

    it('does NOT create an alert when band stays the same (Severe -> Severe)', async () => {
      const alert = await createAutoAlert(sampleRegion._id, 'Severe', 'Severe');

      expect(alert).toBeNull();
      const count = await Alert.countDocuments();
      expect(count).toBe(0);
    });

    it('does NOT create an alert when band goes down (Severe -> High)', async () => {
      const alert = await createAutoAlert(sampleRegion._id, 'High', 'Severe');

      expect(alert).toBeNull();
      const count = await Alert.countDocuments();
      expect(count).toBe(0);
    });

    it('does NOT create an alert when band goes down (High -> Moderate)', async () => {
      const alert = await createAutoAlert(sampleRegion._id, 'Moderate', 'High');

      expect(alert).toBeNull();
      const count = await Alert.countDocuments();
      expect(count).toBe(0);
    });

    it('does NOT create an alert when band moves up but not into High or Severe (Low -> Moderate)', async () => {
      const alert = await createAutoAlert(sampleRegion._id, 'Moderate', 'Low');

      expect(alert).toBeNull();
      const count = await Alert.countDocuments();
      expect(count).toBe(0);
    });

    it('does NOT create a duplicate auto alert within 60 minutes for the same region and band', async () => {
      // First alert should succeed
      const alert1 = await createAutoAlert(sampleRegion._id, 'High', 'Moderate');
      expect(alert1).not.toBeNull();

      // Immediate second alert for same region & band should be blocked
      const alert2 = await createAutoAlert(sampleRegion._id, 'High', 'Moderate');
      expect(alert2).toBeNull();

      const totalAlerts = await Alert.countDocuments({ regionId: sampleRegion._id, band: 'High' });
      expect(totalAlerts).toBe(1);
    });

    it('creates an auto alert if previous alert for same band was created over 60 minutes ago', async () => {
      // Seed an alert older than 60 minutes
      const seventyMinutesAgo = new Date(Date.now() - 70 * 60 * 1000);
      await Alert.create({
        regionId: sampleRegion._id,
        type: 'auto',
        band: 'High',
        message: 'Older alert',
        createdAt: seventyMinutesAgo
      });

      const newAlert = await createAutoAlert(sampleRegion._id, 'High', 'Moderate');
      expect(newAlert).not.toBeNull();
      expect(newAlert.band).toBe('High');

      const count = await Alert.countDocuments({ regionId: sampleRegion._id, band: 'High' });
      expect(count).toBe(2);
    });

    it('triggers auto alert during computeRiskScoreForRegion when band escalates', async () => {
      // Previous score was Moderate
      await RiskScore.create({
        regionId: sampleRegion._id,
        floodIdx: 30,
        seismicIdx: 30,
        cyclonIdx: 30,
        composite: 30,
        band: 'Moderate',
        stale: false,
        computedAt: new Date(Date.now() - 10 * 60 * 1000)
      });

      // Observations that result in High composite (e.g., heavy rain -> 100 flood index)
      const now = new Date();
      await Observation.create({
        regionId: sampleRegion._id,
        source: 'weather',
        payload: { rainfall24h: 200, windSpeed: 30, pressure: 980 },
        fetchedAt: now
      });
      await Observation.create({
        regionId: sampleRegion._id,
        source: 'river',
        payload: { currentLevel: 5, dangerLevel: 5 },
        fetchedAt: now
      });
      await Observation.create({
        regionId: sampleRegion._id,
        source: 'seismic',
        payload: { earthquakes: [] },
        fetchedAt: now
      });

      const newScore = await computeRiskScoreForRegion(sampleRegion);
      expect(['High', 'Severe']).toContain(newScore.band);

      const alerts = await Alert.find({ regionId: sampleRegion._id, type: 'auto' });
      expect(alerts.length).toBe(1);
      expect(alerts[0].band).toBe(newScore.band);
    });
  });

  describe('2. Stub Notifier', () => {
    it('logs simulated SMS/email broadcast to console', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const sampleAlert = {
        _id: new mongoose.Types.ObjectId(),
        type: 'auto',
        band: 'High',
        regionId: sampleRegion._id,
        message: 'High risk warning'
      };

      notifyAlert(sampleAlert);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ALERT NOTIFIER STUB]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Simulated SMS/Email dispatched')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('3. Manual Alert Endpoint (POST /api/admin/alerts)', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .post('/api/admin/alerts')
        .send({
          regionId: sampleRegion._id,
          message: 'Official flood evacuation advisory.'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error', 'Authentication required');
    });

    it('returns 401 for invalid token', async () => {
      const res = await request(app)
        .post('/api/admin/alerts')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          regionId: sampleRegion._id,
          message: 'Official flood evacuation advisory.'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid or expired token');
    });

    it('returns 403 for non-admin citizen token', async () => {
      const res = await request(app)
        .post('/api/admin/alerts')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          regionId: sampleRegion._id,
          message: 'Official flood evacuation advisory.'
        });

      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty('error', 'Admin access required');
    });

    it('returns 201 and creates manual alert with issuedBy set from JWT user', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const res = await request(app)
        .post('/api/admin/alerts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          regionId: sampleRegion._id,
          message: 'Immediate flash flood alert for low-lying areas. Move to shelters.'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('_id');
      expect(res.body.regionId.toString()).toBe(sampleRegion._id.toString());
      expect(res.body.message).toBe('Immediate flash flood alert for low-lying areas. Move to shelters.');
      expect(res.body.type).toBe('manual');
      expect(res.body.issuedBy).toBe('admin@hazard.gov.in');
      expect(res.body.createdAt).toBeDefined();

      const saved = await Alert.findById(res.body._id);
      expect(saved).not.toBeNull();
      expect(saved.issuedBy).toBe('admin@hazard.gov.in');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ALERT NOTIFIER STUB]')
      );
      consoleSpy.mockRestore();
    });

    it('returns 400 when message is empty or only whitespace', async () => {
      const resEmpty = await request(app)
        .post('/api/admin/alerts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          regionId: sampleRegion._id,
          message: ''
        });

      expect(resEmpty.statusCode).toBe(400);
      expect(resEmpty.body).toHaveProperty('error', 'Alert message is required');

      const resWhitespace = await request(app)
        .post('/api/admin/alerts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          regionId: sampleRegion._id,
          message: '   \n\t  '
        });

      expect(resWhitespace.statusCode).toBe(400);
      expect(resWhitespace.body).toHaveProperty('error', 'Alert message is required');
    });

    it('returns 400 when message exceeds 500 characters', async () => {
      const longMessage = 'A'.repeat(501);

      const res = await request(app)
        .post('/api/admin/alerts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          regionId: sampleRegion._id,
          message: longMessage
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Alert message must not exceed 500 characters');
    });

    it('returns 400 when regionId is missing or invalid', async () => {
      const resMissing = await request(app)
        .post('/api/admin/alerts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          message: 'Important notice'
        });

      expect(resMissing.statusCode).toBe(400);
      expect(resMissing.body).toHaveProperty('error', 'Region ID is required');

      const resInvalid = await request(app)
        .post('/api/admin/alerts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          regionId: 'not-a-valid-object-id',
          message: 'Important notice'
        });

      expect(resInvalid.statusCode).toBe(400);
      expect(resInvalid.body).toHaveProperty('error', 'Invalid region ID format');
    });

    it('returns 404 when region does not exist', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post('/api/admin/alerts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          regionId: nonExistentId,
          message: 'Important notice'
        });

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error', 'Region not found');
    });
  });

  describe('4. Alert Filtering (GET /api/alerts?since=)', () => {
    it('filters alerts by since ISO date parameter', async () => {
      const t1 = new Date('2026-10-10T10:00:00.000Z');
      const t2 = new Date('2026-10-10T12:00:00.000Z');
      const t3 = new Date('2026-10-10T14:00:00.000Z');

      await Alert.create({
        regionId: sampleRegion._id,
        message: 'Alert at 10 AM',
        type: 'manual',
        band: 'Moderate',
        createdAt: t1
      });

      await Alert.create({
        regionId: sampleRegion._id,
        message: 'Alert at 12 PM',
        type: 'manual',
        band: 'High',
        createdAt: t2
      });

      await Alert.create({
        regionId: sampleRegion._id,
        message: 'Alert at 2 PM',
        type: 'auto',
        band: 'Severe',
        createdAt: t3
      });

      // Filter since 11 AM: should only return 12 PM and 2 PM alerts
      const res = await request(app).get(`/api/alerts?since=${new Date('2026-10-10T11:00:00.000Z').toISOString()}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBe(2);
      expect(res.body[0].message).toBe('Alert at 2 PM');
      expect(res.body[1].message).toBe('Alert at 12 PM');

      // Filter since 1 PM: should return only 2 PM alert
      const res2 = await request(app).get(`/api/alerts?since=${new Date('2026-10-10T13:00:00.000Z').toISOString()}`);
      expect(res2.statusCode).toBe(200);
      expect(res2.body.length).toBe(1);
      expect(res2.body[0].message).toBe('Alert at 2 PM');
    });

    it('returns 400 for invalid since format', async () => {
      const res = await request(app).get('/api/alerts?since=not-a-valid-date');

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid since date format');
    });
  });
});
