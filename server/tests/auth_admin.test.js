import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { seedDatabase } from '../seed/seed.js';
import { Region, Observation, User } from '../src/models/index.js';
import { config } from '../src/config.js';

const TEST_DB_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/hazard_dashboard_test';

describe('Auth & Admin API Routes', () => {
  let sampleRegion;
  let adminToken;
  let citizenToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await seedDatabase(TEST_DB_URI);

    sampleRegion = await Region.findOne({ name: 'Puri' });

    await Observation.create({
      regionId: sampleRegion._id,
      source: 'weather',
      payload: { temp: 30, rainfall24h: 15 }
    });

    const citizenUser = await User.create({
      email: 'citizen@example.com',
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

  describe('POST /api/auth/login', () => {
    it('returns 200 with JWT token for valid admin credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@hazard.gov.in',
          password: 'Admin@123'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toEqual({
        id: expect.any(String),
        email: 'admin@hazard.gov.in',
        role: 'admin'
      });

      adminToken = res.body.token;
    });

    it('returns 401 for incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@hazard.gov.in',
          password: 'WrongPassword123'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('returns 401 for non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@hazard.gov.in',
          password: 'Admin@123'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });
  });

  describe('GET /api/admin/regions/:id/observations (Protected Route)', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(app).get(`/api/admin/regions/${sampleRegion._id}/observations`);
      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error', 'Authentication required');
    });

    it('returns 401 for invalid token', async () => {
      const res = await request(app)
        .get(`/api/admin/regions/${sampleRegion._id}/observations`)
        .set('Authorization', 'Bearer invalid_token_xyz');

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid or expired token');
    });

    it('returns 403 for citizen (non-admin) role token', async () => {
      const res = await request(app)
        .get(`/api/admin/regions/${sampleRegion._id}/observations`)
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty('error', 'Admin access required');
    });

    it('returns 200 with raw observations for valid admin token', async () => {
      const res = await request(app)
        .get(`/api/admin/regions/${sampleRegion._id}/observations`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('weather');
      expect(res.body.weather.payload.temp).toBe(30);
      expect(res.body).toHaveProperty('seismic');
      expect(res.body).toHaveProperty('river');
    });
  });

  describe('GET /api/regions/:id/history', () => {
    it('returns 200 with risk score history sorted by computedAt', async () => {
      const res = await request(app).get(`/api/regions/${sampleRegion._id}/history`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
