import mongoose from 'mongoose';
import { Alert, Region } from '../models/index.js';

export const BAND_RANKS = {
  Low: 1,
  Moderate: 2,
  High: 3,
  Severe: 4
};

/**
 * Stub notifier that logs a simulated SMS/email broadcast.
 */
export function notifyAlert(alert) {
  const alertId = alert._id ? alert._id.toString() : 'new';
  const typeStr = (alert.type || 'unknown').toUpperCase();
  const bandStr = alert.band || 'N/A';
  const recipientRegion = alert.regionId?._id || alert.regionId || 'unknown';
  console.log(
    `[ALERT NOTIFIER STUB] Simulated SMS/Email dispatched -> ID: ${alertId} | Type: ${typeStr} | Band: ${bandStr} | Region: ${recipientRegion} | Message: "${alert.message}"`
  );
}

/**
 * Creates an automatic alert when a region's risk band moves up into High or Severe.
 * Avoids duplicate auto alerts for the same region and band within 60 minutes.
 */
export async function createAutoAlert(regionIdOrOptions, newBandParam, prevBandParam, customMessage) {
  let regionId;
  let newBand;
  let previousBand;
  let message;

  if (typeof regionIdOrOptions === 'object' && regionIdOrOptions !== null && !(regionIdOrOptions instanceof mongoose.Types.ObjectId)) {
    regionId = regionIdOrOptions.regionId || regionIdOrOptions._id;
    newBand = regionIdOrOptions.band || regionIdOrOptions.newBand;
    previousBand = regionIdOrOptions.previousBand || regionIdOrOptions.prevBand;
    message = regionIdOrOptions.message;
  } else {
    regionId = regionIdOrOptions;
    newBand = newBandParam;
    previousBand = prevBandParam;
    message = customMessage;
  }

  // Band must move up into High or Severe
  if (newBand !== 'High' && newBand !== 'Severe') {
    return null;
  }

  const prevRank = BAND_RANKS[previousBand] || 0;
  const newRank = BAND_RANKS[newBand] || 0;

  // Must have moved up compared to previous band
  if (newRank <= prevRank || !previousBand) {
    return null;
  }

  // Check for duplicate auto alert for same region and band in the last 60 minutes
  const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
  const existingAlert = await Alert.findOne({
    regionId,
    type: 'auto',
    band: newBand,
    createdAt: { $gte: sixtyMinutesAgo }
  });

  if (existingAlert) {
    return null;
  }

  if (!message) {
    let regionName = '';
    try {
      const regionDoc = await Region.findById(regionId).lean();
      if (regionDoc?.name) {
        regionName = `${regionDoc.name}: `;
      }
    } catch {
      // Fallback if region lookup fails
    }
    message = `${regionName}High hazard risk detected. Risk level escalated to ${newBand} band. Please follow safety advisories.`;
  }

  const alert = await Alert.create({
    regionId,
    type: 'auto',
    band: newBand,
    message,
    issuedBy: 'system',
    createdAt: new Date()
  });

  notifyAlert(alert);

  return alert;
}
