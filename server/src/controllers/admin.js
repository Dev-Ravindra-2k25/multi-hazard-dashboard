import mongoose from 'mongoose';
import { Region, Observation, Alert, RiskScore } from '../models/index.js';
import { notifyAlert } from '../services/alerts.js';

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

export async function createAdminAlert(req, res, next) {
  try {
    const { regionId, message, band: customBand } = req.body;

    if (!regionId) {
      return res.status(400).json({ error: 'Region ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(regionId)) {
      return res.status(400).json({ error: 'Invalid region ID format' });
    }

    const region = await Region.findById(regionId);
    if (!region) {
      return res.status(404).json({ error: 'Region not found' });
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Alert message is required' });
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length > 500) {
      return res.status(400).json({ error: 'Alert message must not exceed 500 characters' });
    }

    let band = null;
    const validBands = ['Low', 'Moderate', 'High', 'Severe'];
    if (customBand && validBands.includes(customBand)) {
      band = customBand;
    } else {
      const latestScore = await RiskScore.findOne({ regionId }).sort({ computedAt: -1 });
      if (latestScore?.band) {
        band = latestScore.band;
      }
    }

    const issuedBy = req.user?.email || req.user?.id || 'admin';

    const alert = await Alert.create({
      regionId,
      message: trimmedMessage,
      type: 'manual',
      band,
      issuedBy,
      createdAt: new Date()
    });

    notifyAlert(alert);

    res.status(201).json(alert);
  } catch (err) {
    next(err);
  }
}

