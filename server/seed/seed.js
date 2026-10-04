import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../src/config.js';
import { Region, Shelter, User, Config, RiskScore } from '../src/models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function seedDatabase(customUri = null) {
  const uri = customUri || config.mongodbUri;
  const wasAlreadyConnected = mongoose.connection.readyState === 1;

  if (!wasAlreadyConnected) {
    await mongoose.connect(uri);
  }

  try {
    // 1. Read seed files
    const regionsPath = path.join(__dirname, 'regions.json');
    const sheltersPath = path.join(__dirname, 'shelters.json');

    const regionsRaw = await fs.readFile(regionsPath, 'utf-8');
    const sheltersRaw = await fs.readFile(sheltersPath, 'utf-8');

    const regionsData = JSON.parse(regionsRaw);
    const sheltersData = JSON.parse(sheltersRaw);

    // 2. Clear collections
    await Region.deleteMany({});
    await Shelter.deleteMany({});
    await User.deleteMany({ role: 'admin' });
    await Config.deleteOne({ key: 'weights' });

    // 3. Insert Regions
    const insertedRegions = await Region.insertMany(regionsData);
    const regionMap = new Map();
    insertedRegions.forEach((r) => regionMap.set(r.name, r._id));

    // 4. Map and Insert Shelters
    const shelterDocs = sheltersData.map((s) => {
      const regionId = regionMap.get(s.regionName);
      if (!regionId) {
        throw new Error(`Region "${s.regionName}" not found for shelter "${s.name}"`);
      }
      return {
        regionId,
        name: s.name,
        location: s.location,
        capacity: s.capacity
      };
    });
    const insertedShelters = await Shelter.insertMany(shelterDocs);

    // 5. Create Default Admin User
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@hazard.gov.in';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const adminUser = await User.create({
      email: adminEmail,
      passwordHash,
      role: 'admin'
    });

    // 6. Create Default Config (weights 0.4/0.3/0.3)
    const defaultConfig = await Config.create({
      key: 'weights',
      value: {
        flood: 0.4,
        seismic: 0.3,
        cyclone: 0.3
      }
    });

    // 7. Sync Mongoose indexes
    await RiskScore.syncIndexes();

    return {
      regionsCount: insertedRegions.length,
      sheltersCount: insertedShelters.length,
      adminEmail: adminUser.email,
      configKey: defaultConfig.key
    };
  } finally {
    if (!wasAlreadyConnected && !customUri) {
      await mongoose.disconnect();
    }
  }
}

// Execute when invoked directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDatabase()
    .then((result) => {
      console.log('Seed completed successfully:', result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
