import { Router } from 'express';
import { exportScoresCsv } from '../controllers/export.js';

const router = Router();

router.get('/scores.csv', exportScoresCsv);

export default router;
