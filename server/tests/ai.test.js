import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { Region, RiskScore, Alert, User } from '../src/models/index.js';
import llm from '../src/ai/llm.js';
import { config } from '../src/config.js';

const TEST_DB_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/hazard_dashboard_test';

describe('Slice 10: AI Features (Explain Score & Alert Draft)', () => {
  let sampleRegion;
  let sampleScore;
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

    sampleRegion = await Region.create({
      name: 'Puri',
      location: { lat: 19.8135, lon: 85.8312 },
      population: 1698737
    });

    sampleScore = await RiskScore.create({
      regionId: sampleRegion._id,
      floodIdx: 65,
      seismicIdx: 10,
      cyclonIdx: 45,
      composite: 47,
      band: 'Moderate',
      stale: false,
      explanation: null,
      computedAt: new Date()
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

    jest.restoreAllMocks();
  });

  describe('1. Risk Explanation (POST /api/ai/explain/:scoreId)', () => {
    it('explanation is generated once and then cached (LLM called only once for two requests)', async () => {
      const mockExplanationText =
        'Puri has a Moderate composite risk of 47/100, driven primarily by an elevated flood index of 65. ' +
        'Seismic and cyclone risks remain relatively low at this time. ' +
        'Safety tips: 1. Keep emergency grab bags ready. 2. Monitor official river level warnings. 3. Avoid low-lying water channels.';

      const generateSpy = jest.spyOn(llm, 'generateText').mockResolvedValue(mockExplanationText);

      // First request: score has no explanation in DB -> calls LLM and caches
      const res1 = await request(app).post(`/api/ai/explain/${sampleScore._id}`);
      expect(res1.statusCode).toBe(200);
      expect(res1.body).toHaveProperty('explanation', mockExplanationText);
      expect(generateSpy).toHaveBeenCalledTimes(1);

      // Verify persisted in DB
      const updatedScore = await RiskScore.findById(sampleScore._id);
      expect(updatedScore.explanation).toBe(mockExplanationText);

      // Second request: score already has explanation stored -> returns cached without calling LLM
      const res2 = await request(app).post(`/api/ai/explain/${sampleScore._id}`);
      expect(res2.statusCode).toBe(200);
      expect(res2.body).toHaveProperty('explanation', mockExplanationText);
      expect(generateSpy).toHaveBeenCalledTimes(1); // STILL 1 call
    });

    it('returns 503 when the LLM returns null', async () => {
      jest.spyOn(llm, 'generateText').mockResolvedValue(null);

      const res = await request(app).post(`/api/ai/explain/${sampleScore._id}`);
      expect(res.statusCode).toBe(503);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('unavailable');

      // Ensure explanation was not set
      const scoreInDb = await RiskScore.findById(sampleScore._id);
      expect(scoreInDb.explanation).toBeNull();
    });

    it('returns 400 for invalid score ID format', async () => {
      const res = await request(app).post('/api/ai/explain/not-a-valid-id');
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid score ID format');
    });

    it('returns 404 when risk score does not exist', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app).post(`/api/ai/explain/${nonExistentId}`);
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error', 'Risk score not found');
    });
  });

  describe('2. Alert Drafting (POST /api/admin/ai/draft-alert)', () => {
    it('draft-alert needs admin (returns 401 when unauthenticated, 403 for citizen)', async () => {
      // Unauthenticated (no token)
      const res401 = await request(app)
        .post('/api/admin/ai/draft-alert')
        .send({
          regionId: sampleRegion._id,
          tone: 'urgent',
          language: 'en'
        });
      expect(res401.statusCode).toBe(401);
      expect(res401.body).toHaveProperty('error', 'Authentication required');

      // Citizen token (forbidden)
      const res403 = await request(app)
        .post('/api/admin/ai/draft-alert')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          regionId: sampleRegion._id,
          tone: 'urgent',
          language: 'en'
        });
      expect(res403.statusCode).toBe(403);
      expect(res403.body).toHaveProperty('error', 'Admin access required');
    });

    it('invalid tone or language returns 400', async () => {
      // Invalid tone
      const resInvalidTone = await request(app)
        .post('/api/admin/ai/draft-alert')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          regionId: sampleRegion._id,
          tone: 'aggressive',
          language: 'en'
        });
      expect(resInvalidTone.statusCode).toBe(400);
      expect(resInvalidTone.body.error).toContain('Invalid tone');

      // Missing tone
      const resMissingTone = await request(app)
        .post('/api/admin/ai/draft-alert')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          regionId: sampleRegion._id,
          language: 'en'
        });
      expect(resMissingTone.statusCode).toBe(400);
      expect(resMissingTone.body.error).toContain('Invalid tone');

      // Invalid language
      const resInvalidLang = await request(app)
        .post('/api/admin/ai/draft-alert')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          regionId: sampleRegion._id,
          tone: 'calm',
          language: 'es'
        });
      expect(resInvalidLang.statusCode).toBe(400);
      expect(resInvalidLang.body.error).toContain('Invalid language');

      // Missing language
      const resMissingLang = await request(app)
        .post('/api/admin/ai/draft-alert')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          regionId: sampleRegion._id,
          tone: 'formal'
        });
      expect(resMissingLang.statusCode).toBe(400);
      expect(resMissingLang.body.error).toContain('Invalid language');

      // Invalid regionId
      const resInvalidRegion = await request(app)
        .post('/api/admin/ai/draft-alert')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          regionId: '123-bad-id',
          tone: 'formal',
          language: 'en'
        });
      expect(resInvalidRegion.statusCode).toBe(400);
      expect(resInvalidRegion.body.error).toContain('Invalid or missing region ID');
    });

    it('returns 503 when the LLM returns null during drafting', async () => {
      jest.spyOn(llm, 'generateText').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/admin/ai/draft-alert')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          regionId: sampleRegion._id,
          tone: 'urgent',
          language: 'hi'
        });

      expect(res.statusCode).toBe(503);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('unavailable');
    });

    it('the draft endpoint creates no Alert document and returns draft capped at 400 characters', async () => {
      const mockDraftText =
        'ALERT for Puri district: Moderate hazard level observed. Flood index is elevated at 65. ' +
        'Residents near waterways are advised to remain alert, prepare essential supplies, and monitor district announcements.';

      const generateSpy = jest.spyOn(llm, 'generateText').mockResolvedValue(mockDraftText);

      const countBefore = await Alert.countDocuments();
      expect(countBefore).toBe(0);

      const res = await request(app)
        .post('/api/admin/ai/draft-alert')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          regionId: sampleRegion._id,
          tone: 'urgent',
          language: 'en'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('draft');
      expect(res.body.draft).toBe(mockDraftText);
      expect(res.body.draft.length).toBeLessThanOrEqual(400);
      expect(generateSpy).toHaveBeenCalledTimes(1);

      // Verify that NO Alert document was created!
      const countAfter = await Alert.countDocuments();
      expect(countAfter).toBe(0);
    });

    it('strictly caps draft output at 400 characters even if LLM returns longer text', async () => {
      const excessivelyLongText = 'A'.repeat(550);
      jest.spyOn(llm, 'generateText').mockResolvedValue(excessivelyLongText);

      const res = await request(app)
        .post('/api/admin/ai/draft-alert')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          regionId: sampleRegion._id,
          tone: 'calm',
          language: 'hi'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('draft');
      expect(res.body.draft.length).toBe(400);

      const alertCount = await Alert.countDocuments();
      expect(alertCount).toBe(0);
    });
  });
});
