import { Router } from 'express';
import {
  getAllRegions,
  getRegionById,
  getRegionScore,
  getRegionShelters
} from '../controllers/regions.js';

const router = Router();

router.get('/', getAllRegions);
router.get('/:id', getRegionById);
router.get('/:id/score', getRegionScore);
router.get('/:id/shelters', getRegionShelters);

export default router;
