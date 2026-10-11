import { Router } from 'express';
import { verifyJwt, requireAdmin } from '../middleware/auth.js';
import {
  getAdminRegionObservations,
  createAdminAlert,
  getAdminConfig,
  updateAdminConfig
} from '../controllers/admin.js';

const router = Router();

router.use(verifyJwt);
router.use(requireAdmin);

router.get('/regions/:id/observations', getAdminRegionObservations);
router.post('/alerts', createAdminAlert);
router.get('/config', getAdminConfig);
router.put('/config', updateAdminConfig);

export default router;

