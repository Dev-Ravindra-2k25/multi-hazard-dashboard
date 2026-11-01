import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { explainScore, handleAssistantQuestion } from '../controllers/ai.js';

const explainLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

export const assistantMinuteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Too many requests: limit is 10 requests per minute' }
});

export const assistantDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Daily request quota exceeded: limit is 100 requests per day' }
});

const router = Router();

// POST /api/ai/explain/:scoreId
router.post('/explain/:scoreId', explainLimiter, explainScore);

// POST /api/ai/assistant
router.post(
  '/assistant',
  assistantDailyLimiter,
  assistantMinuteLimiter,
  handleAssistantQuestion
);

export default router;
