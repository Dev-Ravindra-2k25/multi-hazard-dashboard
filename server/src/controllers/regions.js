import mongoose from 'mongoose';
import { Region, RiskScore, Shelter } from '../models/index.js';

export async function getAllRegions(req, res, next) {
  try {
    const regions = await Region.find({}, 'name location population').lean();

    const regionsWithScores = await Promise.all(
      regions.map(async (r) => {
        const latestScore = await RiskScore.findOne({ regionId: r._id })
          .sort({ computedAt: -1 })
          .select('composite band stale computedAt')
          .lean();

        return {
          ...r,
          composite: latestScore ? latestScore.composite : null,
          band: latestScore ? latestScore.band : null,
          stale: latestScore ? latestScore.stale : false,
          latestScore: latestScore || null
        };
      })
    );

    res.json(regionsWithScores);
  } catch (err) {
    next(err);
  }
}

export async function getRegionById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid region ID format' });
    }

    const region = await Region.findById(id)
      .select('name location population createdAt updatedAt')
      .lean();

    if (!region) {
      return res.status(404).json({ error: 'Region not found' });
    }

    res.json(region);
  } catch (err) {
    next(err);
  }
}

export async function getRegionScore(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid region ID format' });
    }

    const regionExists = await Region.exists({ _id: id });
    if (!regionExists) {
      return res.status(404).json({ error: 'Region not found' });
    }

    const score = await RiskScore.findOne({ regionId: id })
      .sort({ computedAt: -1 })
      .select('regionId floodIdx seismicIdx cyclonIdx composite band stale explanation computedAt')
      .lean();

    if (!score) {
      return res.status(404).json({ error: 'No risk score found for this region' });
    }

    res.json(score);
  } catch (err) {
    next(err);
  }
}

export async function getRegionShelters(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid region ID format' });
    }

    const regionExists = await Region.exists({ _id: id });
    if (!regionExists) {
      return res.status(404).json({ error: 'Region not found' });
    }

    const shelters = await Shelter.find({ regionId: id })
      .select('regionId name location capacity')
      .lean();

    res.json(shelters);
  } catch (err) {
    next(err);
  }
}
