import { Router } from 'express';
import { getAlerts } from '../controllers/alerts.js';

const router = Router();

router.get('/', getAlerts);

export default router;
