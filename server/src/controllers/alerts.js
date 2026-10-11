import mongoose from 'mongoose';
import { Alert } from '../models/index.js';

export async function getAlerts(req, res, next) {
  try {
    const { regionId, since } = req.query;
    const filter = {};

    if (regionId) {
      if (!mongoose.Types.ObjectId.isValid(regionId)) {
        return res.status(400).json({ error: 'Invalid region ID format' });
      }
      filter.regionId = regionId;
    }

    if (since) {
      const sinceDate = new Date(since);
      if (isNaN(sinceDate.getTime())) {
        return res.status(400).json({ error: 'Invalid since date format' });
      }
      filter.createdAt = { $gt: sinceDate };
    }

    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .select('regionId message type band issuedBy createdAt')
      .lean();

    res.json(alerts);
  } catch (err) {
    next(err);
  }
}

