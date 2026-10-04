import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { seedDatabase } from '../seed/seed.js';
import {
  Region,
  Shelter,
  User,
  Config,
  RiskScore,
  Observation,
  Alert
} from '../src/models/index.js';

const TEST_DB_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/hazard_dashboard_test';

describe('Database Seed and Models', () => {
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

  it('runs seedDatabase and populates regions, shelters, admin user, and config', async () => {
    const result = await seedDatabase(TEST_DB_URI);

    expect(result.regionsCount).toBe(10);
    expect(result.sheltersCount).toBe(20);
    expect(result.adminEmail).toBe('admin@hazard.gov.in');
    expect(result.configKey).toBe('weights');

    // 1. Verify Regions
    const regions = await Region.find();
    expect(regions).toHaveLength(10);
    const puri = regions.find((r) => r.name === 'Puri');
    expect(puri).toBeDefined();
    expect(puri.location.lat).toBeCloseTo(19.8135);
    expect(puri.location.lon).toBeCloseTo(85.8312);
    expect(puri.population).toBeGreaterThan(0);

    // 2. Verify Shelters (2 per region)
    const shelters = await Shelter.find();
    expect(shelters).toHaveLength(20);

    const regionIds = new Set(regions.map((r) => r._id.toString()));
    shelters.forEach((shelter) => {
      expect(regionIds.has(shelter.regionId.toString())).toBe(true);
      expect(shelter.capacity).toBeGreaterThan(0);
      expect(shelter.location.lat).toBeDefined();
      expect(shelter.location.lon).toBeDefined();
    });

    // 3. Verify Admin User
    const admin = await User.findOne({ email: 'admin@hazard.gov.in' });
    expect(admin).toBeDefined();
    expect(admin.role).toBe('admin');
    const isPasswordValid = await bcrypt.compare('Admin@123', admin.passwordHash);
    expect(isPasswordValid).toBe(true);

    // 4. Verify Config Weights
    const weightsConfig = await Config.findOne({ key: 'weights' });
    expect(weightsConfig).toBeDefined();
    expect(weightsConfig.value).toEqual({
      flood: 0.4,
      seismic: 0.3,
      cyclone: 0.3
    });

    // 5. Verify RiskScore Index { regionId: 1, computedAt: -1 }
    const indexes = await RiskScore.collection.indexes();
    const hasCompoundIndex = indexes.some(
      (idx) => idx.key.regionId === 1 && idx.key.computedAt === -1
    );
    expect(hasCompoundIndex).toBe(true);
  });

  it('can create and validate Observation and Alert records', async () => {
    const region = await Region.findOne();
    expect(region).toBeDefined();

    // Observation
    const obs = await Observation.create({
      regionId: region._id,
      source: 'weather',
      payload: { temp: 32, rainfall24h: 45 }
    });
    expect(obs.source).toBe('weather');
    expect(obs.payload.temp).toBe(32);

    // Alert
    const alert = await Alert.create({
      regionId: region._id,
      message: 'Severe Flood Warning issued',
      type: 'auto',
      band: 'Severe',
      issuedBy: 'system'
    });
    expect(alert.type).toBe('auto');
    expect(alert.band).toBe('Severe');
  });
});
