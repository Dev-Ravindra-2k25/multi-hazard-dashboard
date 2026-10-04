import { Router } from 'express';
import { verifyJwt, requireAdmin } from '../middleware/auth.js';
import { getAdminRegionObservations } from '../controllers/admin.js';

const router = Router();

router.use(verifyJwt);
router.use(requireAdmin);

router.get('/regions/:id/observations', getAdminRegionObservations);

export default router;
