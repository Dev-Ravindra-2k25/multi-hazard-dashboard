import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login } from '../controllers/auth.js';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again after 15 minutes' }
});

const router = Router();

router.post('/login', loginLimiter, login);

export default router;
