import dotenv from 'dotenv';

dotenv.config();

export function getAllowedOrigins(env = process.env) {
  const rawOrigins = env.CLIENT_ORIGIN || env.CLIENT_URL || '';
  const origins = [];

  if (rawOrigins) {
    rawOrigins.split(',').forEach((o) => {
      const trimmed = o.trim();
      if (trimmed && !origins.includes(trimmed)) {
        origins.push(trimmed);
      }
    });
  }

  // Include localhost dev client unless in production
  if (env.NODE_ENV !== 'production') {
    if (!origins.includes('http://localhost:5173')) {
      origins.push('http://localhost:5173');
    }
  }

  return origins;
}

export function validateStartupConfig(env = process.env) {
  const mongodbUri = env.MONGODB_URI;
  if (!mongodbUri || mongodbUri.trim().length === 0) {
    throw new Error('Startup validation failed: MONGODB_URI is missing');
  }

  const isProduction = env.NODE_ENV === 'production';
  const jwtSecret = env.JWT_SECRET || '';

  if (isProduction) {
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new Error(
        'Startup validation failed: JWT_SECRET must be at least 32 characters in production'
      );
    }
  }
}

export const config = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/hazard_dashboard',
  clientOrigin: process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || '',
  allowedOrigins: getAllowedOrigins(process.env),
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY || '',
  jwtSecret: process.env.JWT_SECRET || 'supersecretjwtkey',
  llmProvider: process.env.LLM_PROVIDER || 'gemini',
  llmApiKey: process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || '',
  llmModel: process.env.LLM_MODEL || 'gemini-1.5-flash'
};

export default config;
