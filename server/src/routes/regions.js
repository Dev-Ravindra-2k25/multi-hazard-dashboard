import { Router } from 'express';
import {
  getAllRegions,
  getRegionById,
  getRegionScore,
  getRegionShelters,
  getRegionHistory
} from '../controllers/regions.js';

const router = Router();

router.get('/', getAllRegions);
router.get('/:id', getRegionById);
router.get('/:id/score', getRegionScore);
router.get('/:id/shelters', getRegionShelters);
router.get('/:id/history', getRegionHistory);

export default router;
