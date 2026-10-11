import mongoose from 'mongoose';
import { Region, Observation, Alert, RiskScore, Config } from '../models/index.js';
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

export async function getAdminConfig(req, res, next) {
  try {
    const [weightsDoc, thresholdsDoc] = await Promise.all([
      Config.findOne({ key: 'weights' }),
      Config.findOne({ key: 'thresholds' })
    ]);

    const weights = weightsDoc?.value || { flood: 0.4, seismic: 0.3, cyclone: 0.3 };
    const thresholds = thresholdsDoc?.value || [25, 50, 75];

    res.json({
      weights,
      thresholds
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAdminConfig(req, res, next) {
  try {
    const { weights, thresholds } = req.body;

    // 1. Validate weights {flood, seismic, cyclone}
    if (!weights || typeof weights !== 'object') {
      return res.status(400).json({ error: 'Weights configuration is required' });
    }

    const { flood, seismic, cyclone } = weights;
    if (
      typeof flood !== 'number' ||
      typeof seismic !== 'number' ||
      typeof cyclone !== 'number' ||
      isNaN(flood) ||
      isNaN(seismic) ||
      isNaN(cyclone)
    ) {
      return res.status(400).json({ error: 'Weights flood, seismic, and cyclone must be numbers' });
    }

    if (flood < 0 || flood > 1 || seismic < 0 || seismic > 1 || cyclone < 0 || cyclone > 1) {
      return res.status(400).json({ error: 'Each weight must be between 0 and 1' });
    }

    const sum = flood + seismic + cyclone;
    if (Math.abs(sum - 1) > 0.001) {
      return res.status(400).json({ error: 'Weights must sum to 1 (tolerance 0.001)' });
    }

    // 2. Validate thresholds: ascending numbers within 0-100
    if (!thresholds) {
      return res.status(400).json({ error: 'Thresholds configuration is required' });
    }

    let parsedThresholds;
    if (Array.isArray(thresholds)) {
      if (thresholds.length !== 3) {
        return res.status(400).json({ error: 'Thresholds must contain exactly 3 numbers' });
      }
      parsedThresholds = thresholds.map(Number);
    } else if (typeof thresholds === 'object') {
      if (
        thresholds.low === undefined ||
        thresholds.moderate === undefined ||
        thresholds.high === undefined
      ) {
        return res.status(400).json({ error: 'Thresholds must specify low, moderate, and high values' });
      }
      parsedThresholds = [
        Number(thresholds.low),
        Number(thresholds.moderate),
        Number(thresholds.high)
      ];
    } else {
      return res.status(400).json({ error: 'Invalid thresholds format' });
    }

    for (const val of parsedThresholds) {
      if (typeof val !== 'number' || isNaN(val)) {
        return res.status(400).json({ error: 'All thresholds must be valid numbers' });
      }
      if (val < 0 || val > 100) {
        return res.status(400).json({ error: 'Thresholds must be between 0 and 100' });
      }
    }

    if (
      !(parsedThresholds[0] < parsedThresholds[1] && parsedThresholds[1] < parsedThresholds[2])
    ) {
      return res.status(400).json({ error: 'Thresholds must be ascending numbers within 0-100' });
    }

    const cleanWeights = {
      flood: Math.round(flood * 1000) / 1000,
      seismic: Math.round(seismic * 1000) / 1000,
      cyclone: Math.round(cyclone * 1000) / 1000
    };

    await Promise.all([
      Config.findOneAndUpdate(
        { key: 'weights' },
        { value: cleanWeights },
        { upsert: true, new: true }
      ),
      Config.findOneAndUpdate(
        { key: 'thresholds' },
        { value: parsedThresholds },
        { upsert: true, new: true }
      )
    ]);

    res.json({
      weights: cleanWeights,
      thresholds: parsedThresholds
    });
  } catch (err) {
    next(err);
  }
}

