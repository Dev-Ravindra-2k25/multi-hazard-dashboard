import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { config } from '../src/config.js';
import { User } from '../src/models/index.js';

dotenv.config();

export async function createOrUpdateAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    console.error('Error: ADMIN_EMAIL environment variable is missing or invalid');
    if (process.env.NODE_ENV !== 'test') process.exit(1);
    throw new Error('ADMIN_EMAIL is missing or invalid');
  }

  if (!password || typeof password !== 'string' || password.length < 12) {
    console.error('Error: ADMIN_PASSWORD must be at least 12 characters long');
    if (process.env.NODE_ENV !== 'test') process.exit(1);
    throw new Error('ADMIN_PASSWORD must be at least 12 characters long');
  }

  try {
    await mongoose.connect(config.mongodbUri);

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await User.findOneAndUpdate(
      { email },
      {
        email,
        passwordHash,
        role: 'admin'
      },
      { upsert: true, returnDocument: 'after' }
    );

    console.log(`Admin user "${admin.email}" created or updated successfully.`);
    return admin;
  } catch (err) {
    console.error('Error creating/updating admin user:', err.message);
    if (process.env.NODE_ENV !== 'test') process.exit(1);
    throw err;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

if (process.argv[1] && process.argv[1].includes('createAdmin.js')) {
  createOrUpdateAdmin()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default createOrUpdateAdmin;
