import mongoose from 'mongoose';
import { Region, Observation } from '../models/index.js';

export async function getAdminRegionObservations(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid region ID format' });
    }

    const regionExists = await Region.exists({ _id: id });
    if (!regionExists) {
      return res.status(404).json({ error: 'Region not found' });
    }

    const [weatherObs, seismicObs, riverObs] = await Promise.all([
      Observation.findOne({ regionId: id, source: 'weather' }).sort({ fetchedAt: -1 }).lean(),
      Observation.findOne({ regionId: id, source: 'seismic' }).sort({ fetchedAt: -1 }).lean(),
      Observation.findOne({ regionId: id, source: 'river' }).sort({ fetchedAt: -1 }).lean()
    ]);

    res.json({
      weather: weatherObs || null,
      seismic: seismicObs || null,
      river: riverObs || null
    });
  } catch (err) {
    next(err);
  }
}
