import { Router } from 'express';
import { verifyJwt, requireAdmin } from '../middleware/auth.js';
import { getAdminRegionObservations, createAdminAlert } from '../controllers/admin.js';

const router = Router();

router.use(verifyJwt);
router.use(requireAdmin);

router.get('/regions/:id/observations', getAdminRegionObservations);
router.post('/alerts', createAdminAlert);

export default router;

