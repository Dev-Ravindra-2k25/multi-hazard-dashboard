import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { explainScore } from '../controllers/ai.js';

const explainLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

const router = Router();

// POST /api/ai/explain/:scoreId
router.post('/explain/:scoreId', explainLimiter, explainScore);

export default router;
