import mongoose from 'mongoose';
import { Region, RiskScore } from '../models/index.js';

/**
 * Escapes CSV field value according to RFC 4180 rules.
 * Encloses strings with commas, quotes, or newlines in double quotes,
 * and escapes double quotes by doubling them.
 */
function escapeCsvValue(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * GET /api/export/scores.csv
 * Public export endpoint streaming RiskScores matching optional filters.
 * Parameters:
 *   ?regionId= (ObjectId)
 *   ?from= (ISO Date string, defaults to last 30 days)
 *   ?to= (ISO Date string, defaults to now)
 * Capped at 50,000 rows.
 */
export async function exportScoresCsv(req, res, next) {
  try {
    const { regionId, from, to } = req.query;

    // 1. Validate regionId if provided
    if (regionId) {
      if (!mongoose.Types.ObjectId.isValid(regionId)) {
        return res.status(400).json({ error: 'Invalid region ID' });
      }
      const regionExists = await Region.exists({ _id: regionId });
      if (!regionExists) {
        return res.status(400).json({ error: 'Region not found' });
      }
    }

    // 2. Validate and default dates
    let startDate;
    if (from) {
      startDate = new Date(from);
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({ error: 'Invalid from date' });
      }
    } else {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    let endDate;
    if (to) {
      endDate = new Date(to);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({ error: 'Invalid to date' });
      }
    } else {
      endDate = new Date();
    }

    if (startDate > endDate) {
      return res.status(400).json({ error: 'From date must not be greater than To date' });
    }

    // 3. Build filter
    const filter = {
      computedAt: { $gte: startDate, $lte: endDate }
    };
    if (regionId) {
      filter.regionId = regionId;
    }

    // 4. Preload region names map for fast O(1) lookup
    const regions = await Region.find({}, 'name').lean();
    const regionMap = new Map();
    regions.forEach((r) => regionMap.set(r._id.toString(), r.name));

    // 5. Set CSV response headers
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="scores.csv"');

    // Write CSV header row
    res.write('region,computedAt,floodIdx,seismicIdx,cyclonIdx,composite,band,stale\n');

    // 6. Query cursor to stream rows without loading 50k documents in memory
    const cursor = RiskScore.find(filter)
      .sort({ computedAt: -1 })
      .limit(50000)
      .lean()
      .cursor();

    for await (const doc of cursor) {
      const regionName = regionMap.get(doc.regionId?.toString()) || '';
      const computedAtIso = doc.computedAt ? new Date(doc.computedAt).toISOString() : '';
      const staleStr = doc.stale ? 'true' : 'false';

      const row = [
        escapeCsvValue(regionName),
        escapeCsvValue(computedAtIso),
        escapeCsvValue(doc.floodIdx ?? ''),
        escapeCsvValue(doc.seismicIdx ?? ''),
        escapeCsvValue(doc.cyclonIdx ?? ''),
        escapeCsvValue(doc.composite ?? ''),
        escapeCsvValue(doc.band ?? ''),
        escapeCsvValue(staleStr)
      ].join(',');

      res.write(row + '\n');
    }

    res.end();
  } catch (err) {
    if (!res.headersSent) {
      next(err);
    } else {
      res.end();
    }
  }
}
