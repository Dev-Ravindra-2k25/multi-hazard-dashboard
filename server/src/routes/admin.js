import { Router } from 'express';
import { verifyJwt, requireAdmin } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import {
  getAdminRegionObservations,
  createAdminAlert,
  getAdminConfig,
  updateAdminConfig
} from '../controllers/admin.js';
import { draftAlertHandler } from '../controllers/ai.js';

const draftLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many draft requests, please try again later' }
});

const router = Router();

router.use(verifyJwt);
router.use(requireAdmin);

router.get('/regions/:id/observations', getAdminRegionObservations);
router.post('/alerts', createAdminAlert);
router.get('/config', getAdminConfig);
router.put('/config', updateAdminConfig);
router.post('/ai/draft-alert', draftLimiter, draftAlertHandler);

export default router;

