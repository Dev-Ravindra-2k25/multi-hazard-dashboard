import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { Region, RiskScore, Alert, User, Shelter, Observation, Config } from '../src/models/index.js';
import llm from '../src/ai/llm.js';
import { config } from '../src/config.js';

const TEST_DB_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/hazard_dashboard_test';

describe('AI Features (Slice 10: Explain & Alert Draft, Slice 11: Citizen Assistant)', () => {
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
    await Shelter.deleteMany({});
    await Observation.deleteMany({});
    await Config.deleteMany({});

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

  describe('3. Citizen Assistant (POST /api/ai/assistant)', () => {
    it('returns 400 for an invalid id, empty question, and a 301-character question', async () => {
      // 1. Invalid ID
      const resInvalidId = await request(app)
        .post('/api/ai/assistant')
        .send({
          regionId: 'not-an-object-id',
          question: 'Where is the shelter?'
        });
      expect(resInvalidId.statusCode).toBe(400);
      expect(resInvalidId.body).toHaveProperty('error');
      expect(resInvalidId.body.error).toContain('Invalid or missing region ID');

      // 2. Empty question
      const resEmpty = await request(app)
        .post('/api/ai/assistant')
        .send({
          regionId: sampleRegion._id,
          question: '   '
        });
      expect(resEmpty.statusCode).toBe(400);
      expect(resEmpty.body).toHaveProperty('error');
      expect(resEmpty.body.error).toContain('Question is required');

      // 3. 301-character question
      const longQuestion = 'Q'.repeat(301);
      const resLong = await request(app)
        .post('/api/ai/assistant')
        .send({
          regionId: sampleRegion._id,
          question: longQuestion
        });
      expect(resLong.statusCode).toBe(400);
      expect(resLong.body).toHaveProperty('error');
      expect(resLong.body.error).toContain('Question exceeds maximum limit of 300 characters');
    });

    it('returns 404 for an unknown region', async () => {
      const nonExistentRegionId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post('/api/ai/assistant')
        .send({
          regionId: nonExistentRegionId,
          question: 'What is the current risk?'
        });
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error', 'Region not found');
    });

    it('returns 503 when the LLM returns null', async () => {
      jest.spyOn(llm, 'generateText').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/ai/assistant')
        .send({
          regionId: sampleRegion._id,
          question: 'What does this risk level mean?'
        });

      expect(res.statusCode).toBe(503);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('unavailable');
    });

    it('the prompt sent to the LLM contains the requested region’s data and not another region’s', async () => {
      const otherRegion = await Region.create({
        name: 'Wayanad',
        location: { lat: 11.6854, lon: 76.132 },
        population: 817420
      });
      await RiskScore.create({
        regionId: otherRegion._id,
        floodIdx: 88,
        seismicIdx: 12,
        cyclonIdx: 20,
        composite: 52,
        band: 'High'
      });
      await Shelter.create({
        regionId: sampleRegion._id,
        name: 'Puri Beach Cyclone Shelter',
        location: { lat: 19.81, lon: 85.83 },
        capacity: 500
      });
      await Shelter.create({
        regionId: otherRegion._id,
        name: 'Wayanad Hilltop Shelter',
        location: { lat: 11.68, lon: 76.13 },
        capacity: 300
      });

      const generateSpy = jest.spyOn(llm, 'generateText').mockResolvedValue('Puri has 1 shelter at Puri Beach.');

      const res = await request(app)
        .post('/api/ai/assistant')
        .send({
          regionId: sampleRegion._id,
          question: 'Where is the nearest shelter?'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('answer', 'Puri has 1 shelter at Puri Beach.');
      expect(generateSpy).toHaveBeenCalledTimes(1);

      const callArgs = generateSpy.mock.calls[0][0];
      // Contains requested region's data
      expect(callArgs.prompt).toContain('Puri');
      expect(callArgs.prompt).toContain('Puri Beach Cyclone Shelter');

      // Does NOT contain other region's data
      expect(callArgs.prompt).not.toContain('Wayanad');
      expect(callArgs.prompt).not.toContain('Wayanad Hilltop Shelter');
    });

    it('the user’s question is not placed inside the system prompt', async () => {
      const uniqueUserQuestion = 'SPECIAL_TEST_QUESTION_IS_IT_SAFE_TO_TRAVEL_123';
      const generateSpy = jest.spyOn(llm, 'generateText').mockResolvedValue('Avoid low ground.');

      const res = await request(app)
        .post('/api/ai/assistant')
        .send({
          regionId: sampleRegion._id,
          question: uniqueUserQuestion
        });

      expect(res.statusCode).toBe(200);
      expect(generateSpy).toHaveBeenCalledTimes(1);

      const callArgs = generateSpy.mock.calls[0][0];
      // User's question is NOT placed inside system prompt
      expect(callArgs.system).not.toContain(uniqueUserQuestion);
      // User's question is in the user prompt
      expect(callArgs.prompt).toContain(uniqueUserQuestion);
      // maxTokens is set to 250
      expect(callArgs.maxTokens).toBe(250);
    });

    it('no documents are created or changed in any collection', async () => {
      jest.spyOn(llm, 'generateText').mockResolvedValue('Advisory answer text.');

      const regionsBefore = await Region.countDocuments();
      const scoresBefore = await RiskScore.countDocuments();
      const alertsBefore = await Alert.countDocuments();
      const usersBefore = await User.countDocuments();
      const sheltersBefore = await Shelter.countDocuments();
      const obsBefore = await Observation.countDocuments();
      const configsBefore = await Config.countDocuments();

      const scoreBeforeDoc = await RiskScore.findById(sampleScore._id).lean();

      const res = await request(app)
        .post('/api/ai/assistant')
        .send({
          regionId: sampleRegion._id,
          question: 'What should I do now?'
        });

      expect(res.statusCode).toBe(200);

      const regionsAfter = await Region.countDocuments();
      const scoresAfter = await RiskScore.countDocuments();
      const alertsAfter = await Alert.countDocuments();
      const usersAfter = await User.countDocuments();
      const sheltersAfter = await Shelter.countDocuments();
      const obsAfter = await Observation.countDocuments();
      const configsAfter = await Config.countDocuments();

      expect(regionsAfter).toBe(regionsBefore);
      expect(scoresAfter).toBe(scoresBefore);
      expect(alertsAfter).toBe(alertsBefore);
      expect(usersAfter).toBe(usersBefore);
      expect(sheltersAfter).toBe(sheltersBefore);
      expect(obsAfter).toBe(obsBefore);
      expect(configsAfter).toBe(configsBefore);

      const scoreAfterDoc = await RiskScore.findById(sampleScore._id).lean();
      expect(scoreAfterDoc).toEqual(scoreBeforeDoc);
    });

    it('returns 429 after the rate limit is exceeded', async () => {
      jest.spyOn(llm, 'generateText').mockResolvedValue('Factual response.');

      let hit429 = false;
      let errorResponse = null;

      // Send requests until the 10 requests per minute limit triggers 429
      for (let i = 0; i < 15; i++) {
        const res = await request(app)
          .post('/api/ai/assistant')
          .send({
            regionId: sampleRegion._id,
            question: `Rate limit test question ${i}`
          });

        if (res.statusCode === 429) {
          hit429 = true;
          errorResponse = res;
          break;
        }
      }

      expect(hit429).toBe(true);
      expect(errorResponse.statusCode).toBe(429);
      expect(errorResponse.body).toHaveProperty('error');
      expect(errorResponse.body.error).toContain('limit');
    });
  });
});
