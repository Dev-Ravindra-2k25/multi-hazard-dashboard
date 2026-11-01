import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/hazard_dashboard',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY || '',
  jwtSecret: process.env.JWT_SECRET || 'supersecretjwtkey',
  llmProvider: process.env.LLM_PROVIDER || 'gemini',
  llmApiKey: process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || '',
  llmModel: process.env.LLM_MODEL || 'gemini-1.5-flash'
};

export default config;
